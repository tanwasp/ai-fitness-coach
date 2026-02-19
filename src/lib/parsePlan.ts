/**
 * Given the full plan markdown and a JS Date, extract the section that
 * corresponds to that date as a markdown string.
 *
 * Plan headings look like:  ## Thu Feb 19 — Quality run …
 */

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
  // Match patterns like "Feb 19" or "Mar 4"
  const m = line.match(/##[^#].*?([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (!m) return null;
  const month = MONTH_MAP[m[1]];
  if (month === undefined) return null;
  const day = parseInt(m[2], 10);
  // Always 2026 for this plan
  return new Date(2026, month, day);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface TodaySection {
  heading: string; // e.g. "Thu Feb 19 — Quality run (intervals) + core (short)"
  body: string; // markdown body of that section
  found: boolean;
}

export function extractTodaySection(planMd: string, today: Date): TodaySection {
  const lines = planMd.split("\n");
  let targetIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const d = headingDate(lines[i]);
    if (d && isSameDay(d, today)) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return { heading: "", body: "", found: false };
  }

  const headingLine = lines[targetIndex];
  const heading = headingLine.replace(/^##\s*/, "").trim();

  // Collect lines until the next ## heading or end of file
  const bodyLines: string[] = [];
  for (let i = targetIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) break;
    bodyLines.push(lines[i]);
  }

  return { heading, body: bodyLines.join("\n").trim(), found: true };
}
