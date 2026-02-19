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

// ── Types ──────────────────────────────────────────────────────────────────
type ActivityKind =
  | "lift"
  | "conditioning"
  | "run"
  | "core"
  | "warmup"
  | "other";

interface Metric {
  key: string;
  label: string;
  color: string;
  unit: string;
}

// ── Activity classification ─────────────────────────────────────────────
function classify(activityType: string, sessionType: string): ActivityKind {
  const a = activityType.toLowerCase();
  const s = sessionType.toLowerCase();
  if (a === "football" || s === "conditioning") return "conditioning";
  if (a === "lift" && s === "strength") return "lift";
  if (a === "run") return "run";
  if (s === "core") return "core";
  if (a === "warmup") return "warmup";
  return "other";
}

// ── Metrics to show per kind ────────────────────────────────────────────
// All possible metrics per kind. At render time we filter out any metric
// where every data point is null, so "No data yet" cards never appear.
const METRICS_BY_KIND: Record<ActivityKind, Metric[]> = {
  lift: [
    {
      key: "max_weight",
      label: "Max Weight (lb)",
      color: "#60a5fa",
      unit: "lb",
    },
    {
      key: "volume",
      label: "Volume (reps × lb)",
      color: "#a78bfa",
      unit: "lb",
    },
    { key: "total_reps", label: "Total Reps", color: "#34d399", unit: "" },
    { key: "duration", label: "Duration (min)", color: "#fb923c", unit: "min" },
  ],
  conditioning: [
    { key: "duration", label: "Duration (min)", color: "#fb923c", unit: "min" },
  ],
  run: [
    { key: "duration", label: "Duration (min)", color: "#34d399", unit: "min" },
    { key: "distance", label: "Distance (km)", color: "#60a5fa", unit: "km" },
  ],
  core: [
    { key: "total_reps", label: "Total Reps", color: "#34d399", unit: "" },
    { key: "duration", label: "Duration (min)", color: "#fb923c", unit: "min" },
  ],
  warmup: [
    { key: "total_reps", label: "Total Reps", color: "#94a3b8", unit: "" },
    { key: "duration", label: "Duration (min)", color: "#fb923c", unit: "min" },
  ],
  other: [
    { key: "total_reps", label: "Total Reps", color: "#34d399", unit: "" },
    { key: "duration", label: "Duration (min)", color: "#fb923c", unit: "min" },
  ],
};

// ── Compute one value per date ──────────────────────────────────────────
function computeValue(rows: LogEntry[], metric: string): number | null {
  switch (metric) {
    case "max_weight": {
      const vals = rows
        .map((r) => r.weight_lb)
        .filter((v): v is number => v !== null);
      return vals.length ? Math.max(...vals) : null;
    }
    case "volume": {
      let sum = 0;
      for (const r of rows)
        if (r.reps && r.weight_lb) sum += r.reps * r.weight_lb;
      return sum || null;
    }
    case "total_reps":
      return rows.reduce((s, r) => s + (r.reps ?? 0), 0) || null;
    case "duration":
      return rows.reduce((s, r) => s + (r.duration_min ?? 0), 0) || null;
    case "distance":
      return rows.reduce((s, r) => s + (r.distance_km ?? 0), 0) || null;
    default:
      return null;
  }
}

// ── Single mini chart ───────────────────────────────────────────────────
function MiniChart({
  data,
  metric,
  className = "",
}: {
  data: { date: string; value: number | null }[];
  metric: Metric;
  className?: string;
}) {
  const points = data
    .filter((d) => d.value !== null)
    .map((d) => ({
      date: d.date.slice(5), // MM-DD
      value: d.value,
    }));

  const isEmpty = points.length === 0;
  const singlePoint = points.length === 1;

  // For a single data point give the Y-axis breathing room
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yDomain: [any, any] = singlePoint
    ? [(v: number) => Math.max(0, v * 0.85), (v: number) => v * 1.15 || 1]
    : ["auto", "auto"];

  return (
    <div
      className={`bg-surface rounded-xl border border-surface-border p-3 ${className}`}
    >
      <div className="text-xs font-semibold text-slate-300 mb-1">
        {metric.label}
      </div>
      {isEmpty ? (
        <div className="flex items-center justify-center h-28 text-xs text-slate-600 italic">
          No data yet — log a session to see this chart.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart
            data={points}
            margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#232d3f" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              width={42}
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
                `${v} ${metric.unit}`.trim(),
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
      {singlePoint && (
        <div className="text-[10px] text-slate-500 mt-1">
          1 data point · log more sessions to build the trend line.
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────
export default function TrendsClient({ entries }: { entries: LogEntry[] }) {
  const exercises = useMemo(
    () => [...new Set(entries.map((e) => e.exercise).filter(Boolean))].sort(),
    [entries],
  );

  const [exercise, setExercise] = useState(() => {
    return exercises.includes("Bench Press")
      ? "Bench Press"
      : (exercises[0] ?? "");
  });
  const [agg, setAgg] = useState<"by_date" | "by_session">("by_date");

  // Determine kind and metrics for selected exercise
  const { kind, metrics } = useMemo(() => {
    const exEntries = entries.filter((e) => e.exercise === exercise);
    const first = exEntries[0];
    const k = first
      ? classify(first.activity_type, first.session_type)
      : "other";
    return { kind: k, metrics: METRICS_BY_KIND[k] };
  }, [entries, exercise]);

  // Build series data
  const chartData = useMemo(() => {
    const exEntries = entries.filter((e) => e.exercise === exercise);

    let groups: Map<string, LogEntry[]>;
    if (agg === "by_date") {
      groups = new Map();
      for (const e of exEntries) {
        const key = e.date;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
      }
    } else {
      groups = new Map();
      for (const e of exEntries) {
        const key = `${e.date} · ${e.session_name}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
      }
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

  const kindBadge: Record<ActivityKind, string> = {
    lift: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
    conditioning:
      "bg-accent-orange/10 text-accent-orange border-accent-orange/20",
    run: "bg-accent-green/10 text-accent-green border-accent-green/20",
    core: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
    warmup: "bg-slate-700/30 text-slate-400 border-slate-600",
    other: "bg-slate-700/30 text-slate-400 border-slate-600",
  };

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
            <option key={ex} value={ex}>
              {ex}
            </option>
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

        <span
          className={`flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${kindBadge[kind]}`}
        >
          {kind}
        </span>
      </div>

      {/* Chart grid */}
      <div
        className={`grid gap-3 ${chartData.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}
      >
        {chartData
          .filter(({ data }) => data.some((d) => d.value !== null))
          .map(({ metric, data }) => (
            <MiniChart key={metric.key} data={data} metric={metric} />
          ))}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        Charts auto-adapt to the exercise type ({kind}). Log more sessions to
        build out the trend lines.
      </p>
    </div>
  );
}
