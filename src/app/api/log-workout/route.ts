import { buildLogParserPrompt, buildPlanReviewPrompt } from "@/lib/buildContext";
import { getUserData } from "@/lib/data";
import { extractTodaySection } from "@/lib/parsePlan";
import { getETDate } from "@/lib/timezone";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const EntrySchema = z.object({
  date: z.string(),
  session_name: z.string(),
  session_type: z.string(),
  activity_type: z.string(),
  exercise: z.string(),
  variant_or_details: z.string().optional().default(""),
  set_type: z.string().optional().default(""),
  set_number: z.number().nullable().optional().default(null),
  reps: z.number().nullable().optional().default(null),
  weight_lb: z.number().nullable().optional().default(null),
  weight_each_db_lb: z.number().nullable().optional().default(null),
  assistance_level: z.number().nullable().optional().default(null),
  duration_min: z.number().nullable().optional().default(null),
  distance_km: z.number().nullable().optional().default(null),
  pace_note: z.string().optional().default(""),
  rpe: z.number().nullable().optional().default(null),
  notes: z.string().optional().default(""),
});

export type ParsedEntry = z.infer<typeof EntrySchema>;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !process.env.PERPLEXITY_API_KEY ||
    process.env.PERPLEXITY_API_KEY === "your_key_here"
  ) {
    return Response.json(
      { error: "Add your PERPLEXITY_API_KEY to dashboard/.env.local" },
      { status: 400 },
    );
  }

  let text: string;
  try {
    ({ text } = await req.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!text?.trim()) {
    return Response.json(
      { error: "No workout description provided." },
      { status: 400 },
    );
  }

  const today = getETDate();

  // ── Build context for the parser prompt ────────────────────────────────────
  const db = getUserData(session.userId);

  // Unique exercise names from existing log (for standardisation)
  const existingExercises = [
    ...new Set(
      db.readLog()
        .map((e) => e.exercise)
        .filter((ex) => ex && ex.trim().length > 0),
    ),
  ].sort();

  const systemPrompt = buildLogParserPrompt(today, existingExercises);
  const model = process.env.PERPLEXITY_MODEL ?? "sonar-pro";

  let rawResponse: string;
  try {
    const upstream = await fetch("https://api.perplexity.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        max_output_tokens: 4096,
        instructions: systemPrompt,
        input: [
          {
            type: "message",
            role: "user",
            content: `Parse this workout into structured log entries:\n\n${text}`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      console.error(
        "[log-workout] Perplexity error:",
        upstream.status,
        errBody,
      );
      return Response.json(
        { error: `Perplexity API error ${upstream.status}`, detail: errBody },
        { status: 502 },
      );
    }

    const data = (await upstream.json()) as {
      output?: { type: string; content: { type: string; text: string }[] }[];
    };
    rawResponse = "";
    for (const item of data.output ?? []) {
      if (item.type === "message") {
        for (const chunk of item.content ?? []) {
          if (chunk.type === "output_text") rawResponse += chunk.text;
        }
      }
    }
  } catch (e) {
    console.error("[log-workout] fetch failed:", e);
    return Response.json(
      { error: "Failed to reach Perplexity API.", detail: String(e) },
      { status: 502 },
    );
  }

  // Robustly extract the JSON object from the raw response.
  // Perplexity sometimes wraps output in explanation text or markdown.
  // Strategy: strip code fences, then find the outermost { ... } block.
  function extractJson(raw: string): string {
    // Remove markdown code fences
    let s = raw
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/```\s*$/im, "")
      .trim();

    // Find outermost { ... }
    const firstBrace = s.indexOf("{");
    const lastBrace = s.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return s.slice(firstBrace, lastBrace + 1);
    }

    // Fallback: find outermost [ ... ] (bare array format)
    const firstBracket = s.indexOf("[");
    const lastBracket = s.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return s.slice(firstBracket, lastBracket + 1);
    }

    return s;
  }

  const cleaned = extractJson(rawResponse);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return Response.json(
      { error: "AI returned invalid JSON. Raw response:", raw: rawResponse },
      { status: 422 },
    );
  }

  if (!Array.isArray(parsed) && !(typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).entries))) {
    return Response.json(
      { error: "Expected a JSON object with entries array.", raw: rawResponse },
      { status: 422 },
    );
  }

  // Step 1 result: { entries, needsPlanReview, signals }
  const step1 = parsed as Record<string, unknown>;
  const rawEntries = (Array.isArray(parsed) ? parsed : (step1.entries as Record<string, unknown>[])) ?? [];
  const needsPlanReview = !Array.isArray(parsed) && step1.needsPlanReview === true;
  const signals = (!Array.isArray(parsed) && typeof step1.signals === "string") ? step1.signals : "";

  const validated = (rawEntries as Record<string, unknown>[]).map((item) => {
    const result = EntrySchema.safeParse(item);
    return result.success ? result.data : item;
  });

  // ── Step 2: Plan review call (only when signals detected) ──────────────────
  let planUpdate: unknown = null;

  if (needsPlanReview && signals) {
    try {
      const planFile = db.findActivePlanFile(today);
      const planMd = db.readMarkdown(planFile);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(today.getDate() + 2);
      const { body: tomorrowBody, heading: tomorrowHeading, found: tomorrowFound } =
        extractTodaySection(planMd, tomorrow);
      const { body: dayAfterBody, heading: dayAfterHeading, found: dayAfterFound } =
        extractTodaySection(planMd, dayAfter);

      const nextDaysPlan = [
        tomorrowFound ? `## ${tomorrowHeading}\n${tomorrowBody}` : "",
        dayAfterFound ? `## ${dayAfterHeading}\n${dayAfterBody}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      if (nextDaysPlan) {
        const reviewPrompt = buildPlanReviewPrompt(signals, nextDaysPlan, today);
        const reviewUpstream = await fetch("https://api.perplexity.ai/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            stream: false,
            max_output_tokens: 2048,
            instructions: reviewPrompt,
            input: [
              {
                type: "message",
                role: "user",
                content: `Athlete report: ${signals}\n\nShould the upcoming plan be adjusted?`,
              },
            ],
          }),
        });

        if (reviewUpstream.ok) {
          const reviewData = (await reviewUpstream.json()) as {
            output?: { type: string; content: { type: string; text: string }[] }[];
          };
          let reviewRaw = "";
          for (const item of reviewData.output ?? []) {
            if (item.type === "message") {
              for (const chunk of item.content ?? []) {
                if (chunk.type === "output_text") reviewRaw += chunk.text;
              }
            }
          }
          const reviewCleaned = reviewRaw
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
          const reviewParsed = JSON.parse(reviewCleaned) as { planUpdate: unknown };
          const pu = reviewParsed.planUpdate;
          if (pu && typeof pu === "object" && (pu as Record<string, unknown>).date) {
            planUpdate = pu;
          }
        }
      }
    } catch (e) {
      // Non-fatal — don't fail log if plan review errors
      console.error("[log-workout] plan review step failed:", e);
    }
  }

  return Response.json({ entries: validated, planUpdate, needsPlanReview, signals });
}
