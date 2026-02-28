import { getUserData } from "./data";
import { extractTodaySection } from "./parsePlan";
import { getETDate } from "./timezone";

/**
 * Returns a tiered log summary:
 * - Last 14 days: full detail per set
 * - Older entries: one line per session (date + session name + key lifts/distances)
 */
function recentLogSummary(userId: string, n = 40): string {
  const { readLog } = getUserData(userId);
  const entries = readLog();
  if (!entries.length) return "No entries logged yet.";

  const cutoff = getETDate();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

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
  if (!db.fileExists("session-notes.md")) return "";
  const notes = db.readMarkdown("session-notes.md");
  // Strip the header comment, keep only note entries
  const content = notes.replace(/^#[^\n]*\n[^\n]*\n/, "").trim();
  if (!content) return "";
  // Return at most the last 3000 chars
  return content.length > 3000 ? content.slice(-3000) : content;
}

export function buildCoachSystemPrompt(today: Date, userId: string): string {
  const db = getUserData(userId);
  const planFile = db.findActivePlanFile(today);
  const planMd = planFile ? db.readMarkdown(planFile) : "";
  const progressionMd = db.readMarkdown("progression.md");
  const { heading, body, found } = extractTodaySection(planMd, today);

  const profile = db.readUserProfile();
  const PROFILE =
    profile?.athleteProfile ??
    "(No profile set — ask the user to complete onboarding.)";

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

WARM-UP & COOL-DOWN RULES (always apply):
- Every session MUST include a warm-up and cool-down. If the athlete skips them, remind them.
- Warm-up: 5–10 min of progressive movement (easy cardio, dynamic stretches, activation work relevant to the session).
- Cool-down: 3–5 min easy movement + static stretching targeting muscles worked.
- When prescribing any session, include a specific warm-up block and cool-down block.

Respond in plain text. Be direct, specific, and actionable. Bullet points are fine.

AFTER your reply, you MAY append one or both of the following special markers — place them at the very end:

[SAVE_NOTE: <note>]
Save a coach note to your permanent memory. Use this:
- WHENEVER the athlete mentions how they felt, energy, sleep, mood, soreness, or injuries
- WHENEVER they complete or describe a workout (note what happened and any observations)
- WHENEVER they hit a PR or notable performance milestone
- WHENEVER they share anything a real coach would want to remember long-term
Keep it 1-3 sentences, factual. Don't save trivial Q&A.

<PLAN_UPDATE date="YYYY-MM-DD">
## DayOfWeek Month DD — Updated session title
Full replacement markdown for the body of that plan day.
</PLAN_UPDATE>
Edit a specific day's plan. The date attribute is REQUIRED (format: YYYY-MM-DD) and must match a day that exists in the current plan.
Use this when:
- Swapping or removing an exercise for today OR any future day
- Reducing volume due to fatigue, soreness, or injury
- Recommending rest or a lighter session
- Reorganising the week based on what actually happened
Write the COMPLETE replacement — do not truncate. You can include multiple <PLAN_UPDATE> blocks to edit several days at once.

IMPORTANT: Only append markers when genuinely needed. Most casual replies will have no markers. Never fabricate markers when nothing needs saving or changing.`;
}

/**
 * Builds the system prompt for STEP 1: parsing a workout description
 * into structured log entries and detecting whether a plan review is needed.
 *
 * Does NOT receive the plan — keeps the first call lean.
 * Returns: { entries, needsPlanReview, signals }
 */
export function buildLogParserPrompt(
  today: Date,
  existingExercises: string[] = [],
): string {
  const csvHeader =
    "date,session_name,session_type,activity_type,exercise,variant_or_details,set_type,set_number,reps,weight_lb,weight_each_db_lb,assistance_level,duration_min,distance_km,pace_note,rpe,notes";

  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const exerciseList =
    existingExercises.length > 0
      ? `\nCANONICAL EXERCISE NAMES (use exact spelling when the user's description matches one of these — fuzzy/case-insensitive):\n${existingExercises.map((e) => `  - ${e}`).join("\n")}\nFor NEW exercises not in the list, use clean Title Case singular form (e.g. "Goblet Squat", "Hip Thrust").\n`
      : `\nUse clean Title Case singular form for exercise names (e.g. "Push Up", "Bench Press").\n`;

  return `You are a fitness data parser. Convert free-form workout descriptions into structured JSON.

Today's date: ${dateStr}
${exerciseList}
CSV SCHEMA FIELDS:
${csvHeader}

PARSING RULES:
- session_type: one of "Strength", "Conditioning", "Core", "Mobility"
- activity_type: one of "lift", "run", "football", "core", "mobility"
- set_type: "warmup", "work", "top_set", or "" if not applicable (warm-up and cool-down exercises should be logged with set_type="warmup" or set_type="cooldown")
- set_number: integer (1-indexed per exercise), null if not applicable
- All weight/reps/duration fields: number or null
- Leave fields null/empty if not mentioned
- If the user says "just the bar", weight_lb = 44 (standard bar weight for this athlete)
- Split each set into a separate entry
- For exercises with multiple sets, generate one entry per set
- Log warm-up and cool-down activities as their own entries (e.g. exercise="General Warm-Up", set_type="warmup")

PLAN REVIEW DETECTION:
After parsing, check if the athlete mentioned ANY of the following:
- Unusual or excessive fatigue / feeling exhausted / wiped out
- Pain, injury, or new soreness in a specific area
- Explicitly wants to change, skip, or swap an upcoming session
- Significantly exceeded expectations (may want to progress faster)
If ANY of the above are present, set needsPlanReview=true and summarise the relevant signals concisely in the "signals" field (1-3 sentences, factual). Otherwise needsPlanReview=false and signals="".

RETURN FORMAT — a single JSON object, no markdown:
{
  "entries": [ /* array of log entry objects with exactly the CSV schema keys */ ],
  "needsPlanReview": false,
  "signals": ""
}`;
}

/**
 * Builds the system prompt for STEP 2: reviewing a plan adjustment.
 * Only called when the parser flagged needsPlanReview=true.
 *
 * @param signals      - Summary of what the athlete reported (from step 1)
 * @param nextDaysPlan - Markdown of the next 1-2 plan days to potentially adjust
 * @param today        - Today's date in ET
 */
export function buildPlanReviewPrompt(
  signals: string,
  nextDaysPlan: string,
  today: Date,
): string {
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return `You are a personal fitness coach reviewing whether a training plan needs adjustment.

Today's date: ${dateStr}

ATHLETE REPORT:
${signals}

UPCOMING PLAN (next 1-2 days):
${nextDaysPlan}

Your job: Decide if any upcoming plan day should be adjusted based on the athlete's report. Be conservative — only make a change when clearly warranted by what was reported (e.g. injury, major fatigue, or explicit request). A normal hard session with expected tiredness does NOT need a change.

If a change IS needed, return the COMPLETE replacement markdown for that plan day, including the ## heading line, warm-up section, all exercises with sets/reps, and cool-down section. Do not truncate.

RETURN FORMAT — a single JSON object, no markdown:
{
  "planUpdate": null
}
OR if a change is warranted:
{
  "planUpdate": {
    "date": "YYYY-MM-DD",
    "content": "## Full heading line\n... complete replacement body ...",
    "reason": "One sentence explaining why this change was made."
  }
}`;
}
