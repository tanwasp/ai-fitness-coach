import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { getUserData } from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const CSV_HEADERS = [
  "date",
  "session_name",
  "session_type",
  "activity_type",
  "exercise",
  "variant_or_details",
  "set_type",
  "set_number",
  "reps",
  "weight_lb",
  "weight_each_db_lb",
  "assistance_level",
  "duration_min",
  "distance_km",
  "pace_note",
  "rpe",
  "notes",
] as const;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const CSV_PATH = getUserData(session.userId).getTrainingLogPath();
  const { entries } = await req.json();

  if (!Array.isArray(entries) || entries.length === 0) {
    return Response.json({ error: "No entries to write." }, { status: 400 });
  }

  // Read existing CSV
  const existing = fs.existsSync(CSV_PATH)
    ? fs.readFileSync(CSV_PATH, "utf-8")
    : CSV_HEADERS.join(",") + "\n";

  const parsed = Papa.parse<Record<string, string>>(existing, {
    header: true,
    skipEmptyLines: true,
  });

  // Merge existing + new
  const allRows = [
    ...parsed.data,
    ...entries.map((e: Record<string, unknown>) => {
      const row: Record<string, string> = {};
      for (const h of CSV_HEADERS) {
        const val = e[h];
        row[h] = val === null || val === undefined ? "" : String(val);
      }
      return row;
    }),
  ];

  // Sort by date
  allRows.sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const output = Papa.unparse(allRows, { columns: [...CSV_HEADERS] });
  fs.writeFileSync(CSV_PATH, output + "\n", "utf-8");

  // Auto-save a coach note summarising what was logged
  try {
    const db = getUserData(session.userId);
    const NOTES_FILE = "session-notes.md";
    const today = new Date();
    const ts = today.toISOString().replace("T", " ").slice(0, 16);

    // Summarise the session: unique exercises + total sets
    const sessionNames = [
      ...new Set(
        entries
          .map((e: Record<string, unknown>) => e.session_name)
          .filter(Boolean),
      ),
    ];
    const exercises = [
      ...new Set(
        entries.map((e: Record<string, unknown>) => e.exercise).filter(Boolean),
      ),
    ] as string[];
    const sessionLabel = sessionNames.length
      ? sessionNames.join(", ")
      : "workout";
    const topExercises =
      exercises.slice(0, 5).join(", ") +
      (exercises.length > 5 ? ` (+${exercises.length - 5} more)` : "");
    const noteText = `Logged ${sessionLabel} — ${entries.length} entries. Exercises: ${topExercises}.`;

    const entry = `\n## ${ts}\n${noteText}\n`;
    if (!db.fileExists(NOTES_FILE)) {
      db.writeMarkdown(
        NOTES_FILE,
        `# Coach Session Notes\n<!-- Auto-appended by AI coach. Do not edit manually. -->\n${entry}`,
      );
    } else {
      db.writeMarkdown(NOTES_FILE, db.readMarkdown(NOTES_FILE) + entry);
    }
  } catch {
    // Non-fatal — don't fail the log write if note saving errors
  }

  return Response.json({ written: entries.length });
}
