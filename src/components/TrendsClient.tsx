"use client";
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { LogEntry } from "@/lib/data";

// ── Exercise kinds ─────────────────────────────────────────────────────────
// Determined from actual data fields present for that exercise.
type ExerciseKind =
  | "weighted"    // has weight_lb or weight_each_db_lb — full volume tracking
  | "bodyweight"  // strength exercise, reps only, no external load
  | "assisted"    // has assistance_level (e.g. Assisted Dip machine)
  | "core_timed"  // timed holds: Plank, Side Plank
  | "core_reps"   // rep-based core: Leg Raise, Ab Roll-Out
  | "run"         // running
  | "conditioning"// football / cardio
  | "warmup"
  | "other";

// Whether the weighted exercise uses dumbbells (affects label copy)
type DbMode = "barbell" | "dumbbell" | "mixed";

interface Metric {
  key: string;
  label: string;
  color: string;
  unit: string;
  note?: string; // optional small caption below chart
}

// ── Effective weight helper ─────────────────────────────────────────────────
// For barbell: weight_lb is the total bar+plates weight.
// For dumbbells: weight_each_db_lb × 2 = total load lifted per rep.
function effectiveWeight(r: LogEntry): number | null {
  if (r.weight_lb != null) return r.weight_lb;
  if (r.weight_each_db_lb != null) return r.weight_each_db_lb * 2;
  return null;
}

// ── Classify an exercise from its log entries ───────────────────────────────
function classifyExercise(rows: LogEntry[]): {
  kind: ExerciseKind;
  dbMode: DbMode;
} {
  if (!rows.length) return { kind: "other", dbMode: "barbell" };

  const first = rows[0];
  const actType = first.activity_type?.toLowerCase() ?? "";
  const sesType = first.session_type?.toLowerCase() ?? "";

  // Running
  if (actType === "run") return { kind: "run", dbMode: "barbell" };

  // Conditioning / Football
  if (actType === "football" || sesType === "conditioning")
    return { kind: "conditioning", dbMode: "barbell" };

  // Warmup activities
  if (actType === "mobility" || sesType === "mobility")
    return { kind: "warmup", dbMode: "barbell" };

  // For strength/core lifts: inspect which weight fields are populated
  const hasWeight = rows.some(
    (r) => r.weight_lb != null || r.weight_each_db_lb != null,
  );
  const hasAssistance = rows.some((r) => r.assistance_level != null);
  const hasDuration = rows.some((r) => r.duration_min != null);

  // Determine dumbbell mode for weighted exercises
  const hasBB = rows.some((r) => r.weight_lb != null && r.weight_each_db_lb == null);
  const hasDB = rows.some((r) => r.weight_each_db_lb != null);
  const dbMode: DbMode =
    hasBB && hasDB ? "mixed" : hasDB ? "dumbbell" : "barbell";

  if (hasWeight) return { kind: "weighted", dbMode };
  if (hasAssistance) return { kind: "assisted", dbMode: "barbell" };

  // Core: timed vs reps
  if (sesType === "core" || actType === "core") {
    return { kind: hasDuration ? "core_timed" : "core_reps", dbMode: "barbell" };
  }

  // Strength with no weight = bodyweight
  if (sesType === "strength" || actType === "lift") {
    return { kind: "bodyweight", dbMode: "barbell" };
  }

  return { kind: "other", dbMode: "barbell" };
}

// ── Metrics per kind ────────────────────────────────────────────────────────
function metricsForKind(kind: ExerciseKind, dbMode: DbMode): Metric[] {
  const weightLabel =
    dbMode === "dumbbell"
      ? "Max Weight (lb total, each×2)"
      : dbMode === "mixed"
        ? "Max Weight (lb total)"
        : "Max Weight (lb)";
  const volumeLabel =
    dbMode === "dumbbell"
      ? "Volume (reps × total lb)"
      : "Volume (reps × lb)";
  const weightNote =
    dbMode === "dumbbell"
      ? "Dumbbell total = each DB weight × 2"
      : dbMode === "mixed"
        ? "Mixed: barbell sets use bar weight; DB sets use each×2"
        : undefined;

  switch (kind) {
    case "weighted":
      return [
        { key: "max_weight",  label: weightLabel,  color: "#60a5fa", unit: "lb", note: weightNote },
        { key: "volume",      label: volumeLabel,  color: "#a78bfa", unit: "lb", note: weightNote },
        { key: "max_reps",    label: "Max Reps (work set)", color: "#34d399", unit: "" },
        { key: "total_sets",  label: "Work Sets",  color: "#fb923c", unit: "" },
      ];
    case "bodyweight":
      return [
        { key: "total_reps",  label: "Total Reps", color: "#34d399", unit: "" },
        { key: "max_reps",    label: "Max Reps (best set)", color: "#60a5fa", unit: "" },
        { key: "total_sets",  label: "Total Sets", color: "#fb923c", unit: "" },
      ];
    case "assisted":
      return [
        { key: "min_assistance", label: "Assistance Level (lower = harder)", color: "#f472b6", unit: "", note: "Lower assistance level = more of your own strength" },
        { key: "total_reps",     label: "Total Reps", color: "#34d399", unit: "" },
      ];
    case "core_timed":
      return [
        { key: "duration",    label: "Total Hold Time (min)", color: "#fb923c", unit: "min" },
        { key: "total_sets",  label: "Sets",  color: "#94a3b8", unit: "" },
      ];
    case "core_reps":
      return [
        { key: "total_reps",  label: "Total Reps",  color: "#34d399", unit: "" },
        { key: "max_reps",    label: "Max Reps (best set)", color: "#60a5fa", unit: "" },
        { key: "total_sets",  label: "Sets", color: "#94a3b8", unit: "" },
      ];
    case "run":
      return [
        { key: "distance",   label: "Distance (km)",      color: "#60a5fa", unit: "km" },
        { key: "duration",   label: "Duration (min)",     color: "#34d399", unit: "min" },
        { key: "pace_minkm", label: "Avg Pace (min/km)",  color: "#f472b6", unit: "min/km" },
        { key: "speed_kmh",  label: "Avg Speed (km/h)",  color: "#fb923c", unit: "km/h" },
      ];
    case "conditioning":
      return [
        { key: "duration", label: "Duration (min)", color: "#fb923c", unit: "min" },
      ];
    case "warmup":
    case "other":
    default:
      return [
        { key: "total_reps", label: "Total Reps",    color: "#94a3b8", unit: "" },
        { key: "duration",   label: "Duration (min)", color: "#fb923c", unit: "min" },
      ];
  }
}

// ── Compute one value per date group ────────────────────────────────────────
function computeValue(rows: LogEntry[], metric: string): number | null {
  // For weight/volume metrics, prefer work+top_set, fallback to all rows
  const workRows = rows.filter(
    (r) => !r.set_type || r.set_type === "work" || r.set_type === "top_set",
  );
  const wRows = workRows.length > 0 ? workRows : rows;

  switch (metric) {
    case "max_weight": {
      const vals = wRows
        .map(effectiveWeight)
        .filter((v): v is number => v !== null);
      return vals.length ? Math.max(...vals) : null;
    }
    case "volume": {
      let sum = 0;
      for (const r of wRows) {
        const w = effectiveWeight(r);
        if (r.reps != null && w != null) sum += r.reps * w;
      }
      return sum || null;
    }
    case "max_reps": {
      const vals = wRows
        .map((r) => r.reps)
        .filter((v): v is number => v != null);
      return vals.length ? Math.max(...vals) : null;
    }
    case "total_reps":
      return rows.reduce((s, r) => s + (r.reps ?? 0), 0) || null;
    case "total_sets":
      return wRows.length || null;
    case "min_assistance": {
      const vals = rows
        .map((r) => r.assistance_level)
        .filter((v): v is number => v != null);
      return vals.length ? Math.min(...vals) : null;
    }
    case "duration":
      return rows.reduce((s, r) => s + (r.duration_min ?? 0), 0) || null;
    case "distance":
      return rows.reduce((s, r) => s + (r.distance_km ?? 0), 0) || null;
    case "pace_minkm": {
      const dist = rows.reduce((s, r) => s + (r.distance_km ?? 0), 0);
      const dur  = rows.reduce((s, r) => s + (r.duration_min ?? 0), 0);
      if (!dist || !dur) return null;
      return Math.round((dur / dist) * 100) / 100;
    }
    case "speed_kmh": {
      const dist = rows.reduce((s, r) => s + (r.distance_km ?? 0), 0);
      const dur  = rows.reduce((s, r) => s + (r.duration_min ?? 0), 0);
      if (!dist || !dur) return null;
      return Math.round((dist / dur * 60) * 10) / 10;
    }
    default:
      return null;
  }
}

// ── Mini chart ───────────────────────────────────────────────────────────────
function MiniChart({
  data,
  metric,
}: {
  data: { date: string; value: number | null }[];
  metric: Metric;
}) {
  const points = data
    .filter((d) => d.value !== null)
    .map((d) => ({ date: d.date.slice(5), value: d.value }));

  const isEmpty = points.length === 0;
  const singlePoint = points.length === 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yDomain: [any, any] = singlePoint
    ? [(v: number) => Math.max(0, v * 0.85), (v: number) => v * 1.15 || 1]
    : ["auto", "auto"];

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-3">
      <div className="text-xs font-semibold text-slate-300 mb-1">
        {metric.label}
      </div>
      {isEmpty ? (
        <div className="flex items-center justify-center h-28 text-xs text-slate-600 italic">
          No data yet — log a session to see this chart.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232d3f" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              width={48}
              unit={metric.unit ? ` ${metric.unit}` : ""}
              domain={yDomain}
            />
            <Tooltip
              contentStyle={{
                background: "#161b27",
                border: "1px solid #232d3f",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color: metric.color }}
              formatter={(v: number) => [
                `${v}${metric.unit ? " " + metric.unit : ""}`,
                metric.label,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={metric.color}
              strokeWidth={2}
              dot={{ r: singlePoint ? 5 : 3, fill: metric.color }}
              activeDot={{ r: singlePoint ? 6 : 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      {metric.note && (
        <div className="text-[10px] text-slate-500 mt-1">{metric.note}</div>
      )}
      {singlePoint && (
        <div className="text-[10px] text-slate-500 mt-0.5">
          1 data point · log more sessions to build the trend line.
        </div>
      )}
    </div>
  );
}

// ── Kind badge styles ────────────────────────────────────────────────────────
const KIND_BADGE: Record<ExerciseKind, string> = {
  weighted:     "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
  bodyweight:   "bg-accent-green/10 text-accent-green border-accent-green/20",
  assisted:     "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
  core_timed:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  core_reps:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  run:          "bg-accent-green/10 text-accent-green border-accent-green/20",
  conditioning: "bg-accent-orange/10 text-accent-orange border-accent-orange/20",
  warmup:       "bg-slate-700/30 text-slate-400 border-slate-600",
  other:        "bg-slate-700/30 text-slate-400 border-slate-600",
};

const KIND_LABEL: Record<ExerciseKind, string> = {
  weighted:     "weighted lift",
  bodyweight:   "bodyweight",
  assisted:     "assisted machine",
  core_timed:   "core · timed",
  core_reps:    "core · reps",
  run:          "run",
  conditioning: "conditioning",
  warmup:       "warm-up",
  other:        "other",
};

// ── Main component ───────────────────────────────────────────────────────────
export default function TrendsClient({ entries }: { entries: LogEntry[] }) {
  const exercises = useMemo(() => {
    const names = [...new Set(entries.map((e) => e.exercise).filter(Boolean))].sort();
    return names.filter((name) => {
      const rows = entries.filter((e) => e.exercise === name);
      return classifyExercise(rows).kind !== "warmup";
    });
  }, [entries]);

  const [exercise, setExercise] = useState(() =>
    exercises.includes("Bench Press") ? "Bench Press" : (exercises[0] ?? ""),
  );
  const [agg, setAgg] = useState<"by_date" | "by_session">("by_date");

  const { kind, dbMode, metrics } = useMemo(() => {
    const exRows = entries.filter((e) => e.exercise === exercise);
    const { kind, dbMode } = classifyExercise(exRows);
    return { kind, dbMode, metrics: metricsForKind(kind, dbMode) };
  }, [entries, exercise]);

  const chartData = useMemo(() => {
    const exRows = entries.filter((e) => e.exercise === exercise);
    const groups = new Map<string, LogEntry[]>();
    for (const e of exRows) {
      const key = agg === "by_date" ? e.date : `${e.date} · ${e.session_name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    const sortedKeys = [...groups.keys()].sort();
    return metrics.map((m) => ({
      metric: m,
      data: sortedKeys.map((key) => ({
        date: key,
        value: computeValue(groups.get(key)!, m.key),
      })),
    }));
  }, [entries, exercise, agg, metrics]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="bg-surface-hover border border-surface-border text-sm rounded-xl px-3 py-2 text-slate-200 flex-1 min-w-[180px]"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
        >
          {exercises.map((ex) => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>

        <select
          className="bg-surface-hover border border-surface-border text-sm rounded-xl px-3 py-2 text-slate-200"
          value={agg}
          onChange={(e) => setAgg(e.target.value as "by_date" | "by_session")}
        >
          <option value="by_date">Group by date</option>
          <option value="by_session">Group by session</option>
        </select>

        <span className={`flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${KIND_BADGE[kind]}`}>
          {KIND_LABEL[kind]}
        </span>
      </div>

      {/* Charts */}
      <div className={`grid gap-3 ${chartData.filter(({ data }) => data.some((d) => d.value !== null)).length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        {chartData
          .filter(({ data }) => data.some((d) => d.value !== null))
          .map(({ metric, data }) => (
            <MiniChart key={metric.key} data={data} metric={metric} />
          ))}
      </div>

      {chartData.every(({ data }) => data.every((d) => d.value === null)) && (
        <div className="text-xs text-slate-500 italic mt-2">
          No chart data yet for <span className="text-slate-300">{exercise}</span>. Log a session to see trends.
        </div>
      )}

      <p className="text-xs text-slate-600 mt-3">
        Charts adapt to exercise type ({KIND_LABEL[kind]}).{" "}
        {kind === "weighted" && dbMode === "dumbbell" && "Dumbbell weight shown as total (each × 2). "}
        Log more sessions to build trend lines.
      </p>
    </div>
  );
}

