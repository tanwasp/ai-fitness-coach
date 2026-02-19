import fs from "fs";
import path from "path";
import Papa from "papaparse";

// Resolve paths relative to the project root (one level up from /dashboard)
const DATA_ROOT = path.resolve(process.cwd(), "..");

export function readMarkdown(relativePath: string): string {
  return fs.readFileSync(path.join(DATA_ROOT, relativePath), "utf-8");
}

export function writeMarkdown(relativePath: string, content: string): void {
  fs.writeFileSync(path.join(DATA_ROOT, relativePath), content, "utf-8");
}

export function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(DATA_ROOT, relativePath));
}

/**
 * Scans coach/ for two-week-plan-YYYY-MM-DD_to_YYYY-MM-DD.md files.
 * Returns the relative path of whichever plan's window contains today.
 * Falls back to the most recently started plan if none matches.
 */
export function findActivePlanFile(today: Date = new Date()): string {
  const coachDir = path.join(DATA_ROOT, "coach");
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(coachDir)
      .filter((f) =>
        /^two-week-plan-\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.md$/.test(f),
      );
  } catch {
    // coach/ dir missing — return legacy fallback
    return "coach/two-week-plan-2026-02-19_to_2026-03-04.md";
  }

  if (files.length === 0) {
    return "coach/two-week-plan-2026-02-19_to_2026-03-04.md";
  }

  // Parse start/end from filename
  interface PlanMeta {
    file: string;
    start: Date;
    end: Date;
  }
  const parsed: PlanMeta[] = files.flatMap((f) => {
    const m = f.match(
      /^two-week-plan-(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.md$/,
    );
    if (!m) return [];
    return [{ file: f, start: new Date(m[1]), end: new Date(m[2]) }];
  });

  // Prefer the plan whose window contains today
  const todayMs = today.getTime();
  const active = parsed.find(
    (p) =>
      todayMs >= p.start.getTime() && todayMs <= p.end.getTime() + 86_400_000,
  );
  if (active) return `coach/${active.file}`;

  // Fallback: most recently started plan
  parsed.sort((a, b) => b.start.getTime() - a.start.getTime());
  return `coach/${parsed[0].file}`;
}

export interface LogEntry {
  date: string;
  session_name: string;
  session_type: string;
  activity_type: string;
  exercise: string;
  variant_or_details: string;
  set_type: string;
  set_number: number | null;
  reps: number | null;
  weight_lb: number | null;
  weight_each_db_lb: number | null;
  assistance_level: number | null;
  duration_min: number | null;
  distance_km: number | null;
  pace_note: string;
  rpe: number | null;
  notes: string;
}

function toNum(v: string): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

export function readLog(): LogEntry[] {
  const csvText = fs.readFileSync(
    path.join(DATA_ROOT, "training_log.csv"),
    "utf-8",
  );
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data.map((row) => ({
    date: (row.date ?? "").trim(),
    session_name: row.session_name ?? "",
    session_type: row.session_type ?? "",
    activity_type: row.activity_type ?? "",
    exercise: (row.exercise ?? "").trim(),
    variant_or_details: row.variant_or_details ?? "",
    set_type: row.set_type ?? "",
    set_number: toNum(row.set_number),
    reps: toNum(row.reps),
    weight_lb: toNum(row.weight_lb),
    weight_each_db_lb: toNum(row.weight_each_db_lb),
    assistance_level: toNum(row.assistance_level),
    duration_min: toNum(row.duration_min),
    distance_km: toNum(row.distance_km),
    pace_note: row.pace_note ?? "",
    rpe: toNum(row.rpe),
    notes: row.notes ?? "",
  }));
}
