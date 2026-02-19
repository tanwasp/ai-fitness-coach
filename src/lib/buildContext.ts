import { getUserData } from "./data";
import { extractTodaySection } from "./parsePlan";

/**
 * Returns a tiered log summary:
 * - Last 14 days: full detail per set
 * - Older entries: one line per session (date + session name + key lifts/distances)
 */
function recentLogSummary(userId: string, n = 40): string {
  const { readLog } = getUserData(userId);
  const entries = readLog();
  if (!entries.length) return "No entries logged yet.";

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = entries.filter((e) => e.date >= cutoffStr);
  const older = entries.filter((e) => e.date < cutoffStr);

  // Full detail for recent entries
  const recentLines = recent.map((e) => {
    const parts: string[] = [`[${e.date}] ${e.exercise}`];
    if (e.session_name) parts.push(`(${e.session_name})`);
    if (e.set_type) parts.push(e.set_type);
    if (e.reps != null) parts.push(`${e.reps} reps`);
    if (e.weight_lb != null) parts.push(`@ ${e.weight_lb} lb`);
    if (e.weight_each_db_lb != null)
      parts.push(`${e.weight_each_db_lb} lb each`);
    if (e.duration_min != null) parts.push(`${e.duration_min} min`);
    if (e.distance_km != null) parts.push(`${e.distance_km} km`);
    if (e.notes) parts.push(`— ${e.notes}`);
    return parts.join(" ");
  });

  // Compressed summary for older entries: one line per date+session
  const sessionMap = new Map<string, string[]>();
  for (const e of older.slice(-n)) {
    const key = `${e.date}|${e.session_name || e.session_type}`;
    if (!sessionMap.has(key)) sessionMap.set(key, []);
    const parts: string[] = [e.exercise];
    if (e.reps != null && e.weight_lb != null)
      parts.push(`${e.reps}×${e.weight_lb}lb`);
    else if (e.distance_km != null) parts.push(`${e.distance_km}km`);
    else if (e.duration_min != null) parts.push(`${e.duration_min}min`);
    sessionMap.get(key)!.push(parts.join(" "));
  }
  const olderLines = Array.from(sessionMap.entries()).map(
    ([key, exercises]) => {
      const [date, session] = key.split("|");
      return `[${date}] ${session}: ${exercises.slice(0, 6).join(", ")}${
        exercises.length > 6 ? ` (+${exercises.length - 6} more)` : ""
      }`;
    },
  );

  const parts: string[] = [];
  if (olderLines.length) {
    parts.push(
      `OLDER SESSIONS (compressed, last ${olderLines.length} sessions before 14 days ago):`,
    );
    parts.push(...olderLines);
    parts.push("");
    parts.push("LAST 14 DAYS (full detail):");
  }
  parts.push(
    ...(recentLines.length ? recentLines : ["No sessions in last 14 days."]),
  );
  return parts.join("\n");
}

/**
 * Builds the full system prompt for the AI coach.
 * Includes profile, recent log, today's plan, and progression rules.
 */
function sessionNotesSummary(userId: string): string {
  const db = getUserData(userId);
  if (!db.fileExists("coach/session-notes.md")) return "";
  const notes = db.readMarkdown("coach/session-notes.md");
  // Strip the header comment, keep only note entries
  const content = notes.replace(/^#[^\n]*\n[^\n]*\n/, "").trim();
  if (!content) return "";
  // Return at most the last 3000 chars
  return content.length > 3000 ? content.slice(-3000) : content;
}

export function buildCoachSystemPrompt(today: Date, userId: string): string {
  const db = getUserData(userId);
  const planFile = db.findActivePlanFile(today);
  const planMd = db.readMarkdown(planFile);
  const progressionMd = db.readMarkdown("coach/progression.md");
  const { heading, body, found } = extractTodaySection(planMd, today);

  const profile = db.readUserProfile();
  const PROFILE = profile?.athleteProfile ?? "(No profile set — ask the user to complete onboarding.)";

  const todayPlanSection = found
    ? `TODAY'S PLAN (${heading}):\n${body}`
    : "TODAY'S PLAN: Outside the current plan window.";

  const logSummary = recentLogSummary(userId, 40);
  const sessionNotes = sessionNotesSummary(userId);
  const notesSection = sessionNotes
    ? `\nCOACH SESSION NOTES (your memory of prior conversations):\n${sessionNotes}\n`
    : "";

  return `You are a personal fitness coach with deep knowledge of this athlete. You are direct, specific, and give actionable advice. You know their full history and goals. Never be vague.

${PROFILE}

RECENT TRAINING LOG (last ~40 entries, newest last):
${logSummary}
${notesSection}
${todayPlanSection}

PROGRESSION RULES SUMMARY:
${progressionMd.slice(0, 3000)}

Today's date: ${today.toDateString()}

Respond in plain text. Be direct, specific, and actionable. Bullet points are fine.

AFTER your reply, you may append one or both of the following special markers if needed — place them at the very end, each on its own line:

[SAVE_NOTE: one or two sentence note about what the athlete mentioned — sleep quality, soreness, mood, energy, injuries, etc. Only include if they shared something personally relevant.]

<PLAN_UPDATE>
## DayOfWeek Month DD — Updated session title here
Full replacement markdown for the body of today's plan section. Always start with the ## heading line (you may update the title to reflect what actually changed). Only include if you are actually changing what they should do today — swapping an exercise, reducing volume, or recommending rest. Do not truncate — write the complete replacement.
</PLAN_UPDATE>

IMPORTANT: Only append markers when genuinely needed. Most replies will have no markers at all. Never invent markers if nothing changed.`;
}

/**
 * Builds the system prompt specifically for parsing a workout description
 * into structured log entries.
 */
export function buildLogParserPrompt(today: Date): string {
  const csvHeader =
    "date,session_name,session_type,activity_type,exercise,variant_or_details,set_type,set_number,reps,weight_lb,weight_each_db_lb,assistance_level,duration_min,distance_km,pace_note,rpe,notes";

  return `You are a fitness data parser. Convert free-form workout descriptions into structured JSON arrays.

Today's date: ${today.toISOString().slice(0, 10)}

CSV schema fields (for reference):
${csvHeader}

Rules:
- session_type: one of "Strength", "Conditioning", "Core", "Mobility"
- activity_type: one of "lift", "run", "football", "core", "mobility"
- set_type: "warmup", "work", "top_set", or "" if not applicable
- set_number: integer (1-indexed per exercise), null if not applicable
- All weight/reps/duration fields: number or null
- Leave fields null/empty if not mentioned
- If the user says "just the bar", weight_lb = 44 (standard bar weight for this athlete)
- Split each set into a separate entry
- For exercises with multiple sets, generate one entry per set

Return ONLY a valid JSON array of objects with exactly these keys:
date, session_name, session_type, activity_type, exercise, variant_or_details, set_type, set_number, reps, weight_lb, weight_each_db_lb, assistance_level, duration_min, distance_km, pace_note, rpe, notes

No explanations, no markdown, just the JSON array.`;
}
