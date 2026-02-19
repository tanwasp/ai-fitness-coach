import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { BASE_DATA_ROOT } from "./users";

// ── User profile shape ─────────────────────────────────────────────────────
export interface UserProfile {
  displayName: string;
  athleteProfile: string;
  goals: { label: string; value: string; current: string; color: string }[];
}

// ── LogEntry shape ─────────────────────────────────────────────────────────
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

// ── Per-user data factory ──────────────────────────────────────────────────
/**
 * Returns a data accessor bound to a specific user's data directory.
 * All paths are relative to BASE_DATA_ROOT/{userId}/.
 */
export function getUserData(userId: string) {
  const root = path.join(BASE_DATA_ROOT, userId);

  function abs(rel: string) {
    return path.join(root, rel);
  }

  function readMarkdown(relativePath: string): string {
    const p = abs(relativePath);
    if (!fs.existsSync(p)) return "";
    return fs.readFileSync(p, "utf-8");
  }

  function writeMarkdown(relativePath: string, content: string): void {
    const p = abs(relativePath);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf-8");
  }

  function fileExists(relativePath: string): boolean {
    return fs.existsSync(abs(relativePath));
  }

  function findActivePlanFile(today: Date = new Date()): string {
    const coachDir = abs("coach");
    let files: string[] = [];
    try {
      files = fs
        .readdirSync(coachDir)
        .filter((f) =>
          /^two-week-plan-\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.md$/.test(f),
        );
    } catch {
      return "";
    }
    if (files.length === 0) return "";

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

    const todayMs = today.getTime();
    const active = parsed.find(
      (p) =>
        todayMs >= p.start.getTime() && todayMs <= p.end.getTime() + 86_400_000,
    );
    if (active) return `coach/${active.file}`;

    parsed.sort((a, b) => b.start.getTime() - a.start.getTime());
    return `coach/${parsed[0].file}`;
  }

  function readLog(): LogEntry[] {
    const csvPath = abs("training_log.csv");
    if (!fs.existsSync(csvPath)) return [];
    const csvText = fs.readFileSync(csvPath, "utf-8");
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

  function getTrainingLogPath(): string {
    return abs("training_log.csv");
  }

  function readUserProfile(): UserProfile | null {
    const p = abs("profile.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8")) as UserProfile;
  }

  function writeUserProfile(profile: UserProfile): void {
    const p = abs("profile.json");
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(profile, null, 2), "utf-8");
  }

  function hasProfile(): boolean {
    return fs.existsSync(abs("profile.json"));
  }

  return {
    readMarkdown,
    writeMarkdown,
    fileExists,
    findActivePlanFile,
    readLog,
    getTrainingLogPath,
    readUserProfile,
    writeUserProfile,
    hasProfile,
    root,
  };
}
