import fs from "fs";
import path from "path";
import Papa from "papaparse";

export const runtime = "nodejs";

const CSV_PATH = path.resolve(process.cwd(), "..", "training_log.csv");

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

  return Response.json({ written: entries.length });
}
