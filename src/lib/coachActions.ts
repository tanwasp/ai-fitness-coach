import { getUserData } from "./data";
import { extractTodaySection } from "./parsePlan";

// Re-use the same date-matching regex from parsePlan
const MONTH_MAP: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function headingDate(line: string): Date | null {
  const m = line.match(/##[^#].*?([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (!m) return null;
  const month = MONTH_MAP[m[1]];
  if (month === undefined) return null;
  return new Date(2026, month, parseInt(m[2], 10));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CoachAction =
  | { type: "save_note"; content: string }
  | { type: "edit_plan_today"; replacement: string };

export interface ActionResult {
  type: "save_note" | "edit_plan_today";
  success: boolean;
  detail?: string;
}

const NOTES_FILE = "coach/session-notes.md";

// ── Main executor ─────────────────────────────────────────────────────────────

export function executeActions(
  actions: CoachAction[],
  today: Date,
  userId: string,
): ActionResult[] {
  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      if (action.type === "save_note") {
        appendNote(action.content, today, userId);
        results.push({ type: "save_note", success: true });
      } else if (action.type === "edit_plan_today") {
        const ok = patchPlanToday(action.replacement, today, userId);
        results.push({
          type: "edit_plan_today",
          success: ok,
          detail: ok ? undefined : "today not found in plan",
        });
      }
    } catch (e) {
      results.push({
        type: action.type,
        success: false,
        detail: String(e),
      });
    }
  }

  return results;
}

// ── Note appender ─────────────────────────────────────────────────────────────

function appendNote(content: string, today: Date, userId: string): void {
  const db = getUserData(userId);
  const ts = today.toISOString().replace("T", " ").slice(0, 16);
  const entry = `\n## ${ts}\n${content.trim()}\n`;

  if (!db.fileExists(NOTES_FILE)) {
    db.writeMarkdown(
      NOTES_FILE,
      `# Coach Session Notes\n<!-- Auto-appended by AI coach. Do not edit manually. -->\n${entry}`,
    );
  } else {
    db.writeMarkdown(NOTES_FILE, db.readMarkdown(NOTES_FILE) + entry);
  }
}

// ── Plan editor ───────────────────────────────────────────────────────────────

function patchPlanToday(replacement: string, today: Date, userId: string): boolean {
  const db = getUserData(userId);
  const planFile = db.findActivePlanFile(today);
  if (!planFile) return false;
  const planMd = db.readMarkdown(planFile);
  const lines = planMd.split("\n");

  // Find today's heading line using date-based matching (immune to heading text changes)
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const d = headingDate(lines[i]);
    if (d && isSameDay(d, today)) {
      start = i;
      break;
    }
  }
  if (start === -1) return false;

  // Find where the next ## heading begins
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }

  // If replacement starts with a ## heading, use it as the new heading;
  // otherwise preserve the original heading.
  const replacementTrimmed = replacement.trim();
  const replacementLines = replacementTrimmed.split("\n");
  const hasNewHeading = replacementLines[0].startsWith("## ");

  const newHeading = hasNewHeading ? replacementLines[0] : lines[start];
  const bodyContent = hasNewHeading
    ? replacementLines.slice(1).join("\n").trim()
    : replacementTrimmed;

  const newPlan = [
    ...lines.slice(0, start),
    newHeading,
    "",
    bodyContent,
    "",
    ...lines.slice(end),
  ].join("\n");

  db.writeMarkdown(planFile, newPlan);
  return true;
}
