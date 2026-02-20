import { buildCoachSystemPrompt } from "@/lib/buildContext";
import {
  executeActions,
  type CoachAction,
  type ActionResult,
} from "@/lib/coachActions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

// ── Perplexity pricing (sonar-pro, as of Feb 2026) ───────────────────────────
// https://docs.perplexity.ai/docs/pricing
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "sonar-pro": { inputPer1M: 3.0, outputPer1M: 15.0 },
  sonar: { inputPer1M: 1.0, outputPer1M: 5.0 },
  "sonar-reasoning-pro": { inputPer1M: 8.0, outputPer1M: 40.0 },
  "sonar-reasoning": { inputPer1M: 1.0, outputPer1M: 5.0 },
};

function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? PRICING["sonar-pro"];
  return (
    (inputTokens / 1_000_000) * p.inputPer1M +
    (outputTokens / 1_000_000) * p.outputPer1M
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  if (
    !process.env.PERPLEXITY_API_KEY ||
    process.env.PERPLEXITY_API_KEY === "your_key_here"
  ) {
    return Response.json(
      { error: "Add your PERPLEXITY_API_KEY to dashboard/.env.local" },
      { status: 400 },
    );
  }

  const { messages } = (await req.json()) as {
    messages: { role: string; content: string }[];
  };

  const today = new Date();
  const systemPrompt = buildCoachSystemPrompt(today, userId);
  const model = process.env.PERPLEXITY_MODEL ?? "sonar-pro";

  const input = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ type: "message", role: m.role, content: m.content }));

  const upstream = await fetch("https://api.perplexity.ai/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
      instructions: systemPrompt,
      stream: false,
      max_output_tokens: 2000,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => `HTTP ${upstream.status}`);
    return Response.json({ error: text }, { status: upstream.status });
  }

  // ── Parse the non-streamed Agent API response ─────────────────────────────
  const body = (await upstream.json()) as {
    output?: {
      type: string;
      role: string;
      content: { type: string; text: string }[];
    }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  // Extract text from output[].content[].text (Agent API format)
  let fullText = "";
  for (const item of body.output ?? []) {
    if (item.type === "message") {
      for (const chunk of item.content ?? []) {
        if (chunk.type === "output_text" && chunk.text) {
          fullText += chunk.text;
        }
      }
    }
  }

  const inputTokens = body.usage?.input_tokens ?? 0;
  const outputTokens = body.usage?.output_tokens ?? 0;

  // ── Parse bracket markers from plain-text response ─────────────────────
  const actions: CoachAction[] = [];

  // Extract [SAVE_NOTE: ...] (single line, no dotAll needed)
  let reply = fullText.replace(
    /\[SAVE_NOTE:\s*([^\]]+?)\s*\]/g,
    (_, content: string) => {
      actions.push({ type: "save_note", content: content.trim() });
      return "";
    },
  );

  // Extract <PLAN_UPDATE> or <PLAN_UPDATE date="YYYY-MM-DD"> (optional date for future days)
  reply = reply.replace(
    /<PLAN_UPDATE(?:\s+date="([^"]+)")?>[\s\S]*?<\/PLAN_UPDATE>/g,
    (fullMatch) => {
      const dateMatch = fullMatch.match(/<PLAN_UPDATE(?:\s+date="([^"]+)")?>/);
      const targetDate = dateMatch?.[1] ?? undefined;
      const contentMatch = fullMatch.match(
        /<PLAN_UPDATE(?:\s+date="[^"]+")?>([\s\S]+?)<\/PLAN_UPDATE>/,
      );
      const content = contentMatch?.[1]?.trim() ?? "";
      if (content) {
        actions.push({
          type: "edit_plan_today",
          replacement: content,
          targetDate,
        });
      }
      return "";
    },
  );

  reply = reply.trim();

  const actionResults: ActionResult[] =
    actions.length > 0 ? executeActions(actions, today, userId) : [];

  if (actionResults.length > 0) {
    console.log("[coach] actions executed:", JSON.stringify(actionResults));
  }

  // ── Compute cost + server-side log ────────────────────────────────────────
  const costUsd = computeCost(model, inputTokens, outputTokens);

  console.log(
    `[coach] model=${model} ` +
      `in=${inputTokens} out=${outputTokens} ` +
      `cost=$${costUsd.toFixed(6)} ` +
      `actions=${actionResults.length}`,
  );

  return Response.json({
    reply,
    actionResults,
    usage: { inputTokens, outputTokens, costUsd, model },
  });
}
