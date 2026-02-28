import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeActions } from "@/lib/coachActions";
import { getETDate } from "@/lib/timezone";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date: string; content: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.date || !body.content) {
    return Response.json(
      { error: "Missing required fields: date, content." },
      { status: 400 },
    );
  }

  const today = getETDate();
  const results = executeActions(
    [{ type: "edit_plan_today", replacement: body.content, targetDate: body.date }],
    today,
    session.userId,
  );

  const result = results[0];
  if (!result.success) {
    return Response.json(
      { error: `Plan update failed: ${result.detail ?? "unknown error"}` },
      { status: 422 },
    );
  }

  return Response.json({ ok: true });
}
