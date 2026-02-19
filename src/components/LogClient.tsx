"use client";
import { useState, useMemo } from "react";
import type { LogEntry } from "@/lib/data";

function sortedUnique<T>(arr: T[]): T[] {
  return [...new Set(arr)].sort() as T[];
}

function DaySummaryBar({ entries }: { entries: LogEntry[] }) {
  const totalReps = entries.reduce((s, e) => s + (e.reps ?? 0), 0);
  const tonnage = entries.reduce(
    (s, e) => (e.reps && e.weight_lb ? s + e.reps * e.weight_lb : s),
    0,
  );
  const totalDur = entries.reduce((s, e) => s + (e.duration_min ?? 0), 0);
  const sets = entries.filter((e) => e.set_type && e.set_type.trim()).length;

  return (
    <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
      <span>
        <span className="text-white font-semibold">{entries.length}</span>{" "}
        entries
      </span>
      <span>
        <span className="text-white font-semibold">{sets}</span> sets
      </span>
      <span>
        <span className="text-white font-semibold">{totalReps}</span> reps
      </span>
      {tonnage > 0 && (
        <span>
          <span className="text-accent-blue font-semibold">
            {Math.round(tonnage).toLocaleString()}
          </span>{" "}
          lb tonnage
        </span>
      )}
      {totalDur > 0 && (
        <span>
          <span className="text-accent-green font-semibold">
            {totalDur.toFixed(0)}
          </span>{" "}
          min duration
        </span>
      )}
    </div>
  );
}

export default function LogClient({ entries }: { entries: LogEntry[] }) {
  const allDates = useMemo(
    () => sortedUnique(entries.map((e) => e.date)).reverse(),
    [entries],
  );
  const [date, setDate] = useState(allDates[0] ?? "");
  const [session, setSession] = useState("");
  const [search, setSearch] = useState("");

  const sessionsForDate = useMemo(
    () =>
      sortedUnique(
        entries.filter((e) => e.date === date).map((e) => e.session_name),
      ),
    [entries, date],
  );

  const filtered = useMemo(() => {
    let rows = entries.filter((e) => e.date === date);
    if (session) rows = rows.filter((e) => e.session_name === session);
    if (search.trim())
      rows = rows.filter((e) =>
        e.exercise.toLowerCase().includes(search.toLowerCase()),
      );
    return rows.sort((a, b) => {
      const ex = a.exercise.localeCompare(b.exercise);
      return ex !== 0 ? ex : (a.set_number ?? 0) - (b.set_number ?? 0);
    });
  }, [entries, date, session, search]);

  const setTypeBadge = (t: string) => {
    const map: Record<string, string> = {
      warmup: "bg-slate-700 text-slate-300",
      work: "bg-accent-blue/15 text-accent-blue",
      top_set: "bg-accent-orange/15 text-accent-orange",
    };
    return map[t] || "bg-surface-hover text-slate-400";
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="bg-surface-hover border border-surface-border text-sm rounded-xl px-3 py-2 text-slate-200 flex-1 min-w-[140px]"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSession("");
          }}
        >
          {allDates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className="bg-surface-hover border border-surface-border text-sm rounded-xl px-3 py-2 text-slate-200 flex-1 min-w-[140px]"
          value={session}
          onChange={(e) => setSession(e.target.value)}
        >
          <option value="">All sessions</option>
          {sessionsForDate.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          className="bg-surface-hover border border-surface-border text-sm rounded-xl px-3 py-2 text-slate-200 flex-1 min-w-[180px] placeholder-slate-600"
          type="search"
          placeholder="Search exercise…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button
          className="bg-accent-blue/15 border border-accent-blue/30 text-accent-blue text-sm font-semibold rounded-xl px-4 py-2 hover:bg-accent-blue/25 transition-colors shrink-0"
          onClick={() => {
            setDate(allDates[0] ?? "");
            setSession("");
            setSearch("");
          }}
        >
          Latest
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="bg-surface-hover text-slate-400 text-left">
              <th className="px-3 py-2.5 font-semibold">Exercise</th>
              <th className="px-3 py-2.5 font-semibold">Details</th>
              <th className="px-3 py-2.5 font-semibold">Set</th>
              <th className="px-3 py-2.5 font-semibold text-right">Reps</th>
              <th className="px-3 py-2.5 font-semibold text-right">Wt (lb)</th>
              <th className="px-3 py-2.5 font-semibold text-right">DB ea.</th>
              <th className="px-3 py-2.5 font-semibold text-right">Assist</th>
              <th className="px-3 py-2.5 font-semibold text-right">Min</th>
              <th className="px-3 py-2.5 font-semibold text-right">Km</th>
              <th className="px-3 py-2.5 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-slate-500 italic"
                >
                  No entries found for this selection.
                </td>
              </tr>
            ) : (
              filtered.map((e, i) => (
                <tr
                  key={i}
                  className="border-t border-surface-border hover:bg-surface-hover/50 transition-colors"
                >
                  <td className="px-3 py-2 font-medium text-white">
                    {e.exercise}
                  </td>
                  <td className="px-3 py-2 text-slate-400 max-w-[180px] truncate">
                    {e.variant_or_details}
                  </td>
                  <td className="px-3 py-2">
                    {e.set_type && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${setTypeBadge(e.set_type)}`}
                      >
                        {e.set_type}
                        {e.set_number != null ? ` ${e.set_number}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{e.reps ?? ""}</td>
                  <td className="px-3 py-2 text-right font-semibold text-accent-blue">
                    {e.weight_lb ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.weight_each_db_lb ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.assistance_level ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right text-accent-green">
                    {e.duration_min ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.distance_km ?? ""}
                  </td>
                  <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">
                    {e.notes}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DaySummaryBar entries={filtered} />
    </div>
  );
}
