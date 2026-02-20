import { getUserData } from "./data";
import { headingDate, isSameDay } from "./parsePlan";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CoachAction =
  | { type: "save_note"; content: string }
  | { type: "edit_plan_today"; replacement: string; targetDate?: string };

export interface ActionResult {
  type: "save_note" | "edit_plan_today";
  success: boolean;
  detail?: string;
}

const NOTES_FILE = "session-notes.md";

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
        const targetDate = action.targetDate
          ? new Date(action.targetDate + "T12:00:00")
          : today;
        const ok = patchPlanToday(action.replacement, targetDate, userId);
        results.push({
          type: "edit_plan_today",
          success: ok,
          detail: ok
            ? action.targetDate
              ? `Updated plan for ${action.targetDate}`
              : undefined
            : `date not found in plan${
                action.targetDate ? ` (${action.targetDate})` : ""
              }`,
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

function patchPlanToday(
  replacement: string,
  today: Date,
  userId: string,
): boolean {
  const db = getUserData(userId);
  const planFile = db.findActivePlanFile(today);
  if (!planFile) return false;
  const planMd = db.readMarkdown(planFile);
  const lines = planMd.split("\n");

  // Find the target heading line using date-based matching
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const d = headingDate(lines[i], today);
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
