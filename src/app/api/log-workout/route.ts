import { buildLogParserPrompt } from "@/lib/buildContext";
import { z } from "zod";

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

  const systemPrompt = buildLogParserPrompt(new Date());
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
        max_output_tokens: 2048,
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

  // Strip any markdown backticks the model might have wrapped around the JSON
  const cleaned = rawResponse
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return Response.json(
      { error: "AI returned invalid JSON. Raw response:", raw: rawResponse },
      { status: 422 },
    );
  }

  if (!Array.isArray(parsed)) {
    return Response.json(
      { error: "Expected a JSON array.", raw: rawResponse },
      { status: 422 },
    );
  }

  const validated = (parsed as Record<string, unknown>[]).map((item) => {
    const result = EntrySchema.safeParse(item);
    return result.success ? result.data : item;
  });

  return Response.json({ entries: validated });
}
