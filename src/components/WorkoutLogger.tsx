"use client";

import { useState } from "react";

interface ParsedEntry {
  date: string;
  session_name: string;
  session_type: string;
  activity_type: string;
  exercise: string;
  variant_or_details?: string;
  set_type?: string;
  set_number?: number | null;
  reps?: number | null;
  weight_lb?: number | null;
  weight_each_db_lb?: number | null;
  assistance_level?: number | null;
  duration_min?: number | null;
  distance_km?: number | null;
  pace_note?: string;
  rpe?: number | null;
  notes?: string;
}

type Stage = "idle" | "parsing" | "preview" | "saving" | "saved" | "error";

export default function WorkoutLogger() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleParse() {
    if (!text.trim()) return;
    setStage("parsing");
    setErrorMsg("");

    try {
      const res = await fetch("/api/log-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Parse failed");
        setStage("error");
        return;
      }

      setEntries(data.entries ?? []);
      setStage("preview");
    } catch (e) {
      setErrorMsg(String(e));
      setStage("error");
    }
  }

  async function handleSave() {
    setStage("saving");
    try {
      const res = await fetch("/api/write-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Save failed");
        setStage("error");
        return;
      }
      setStage("saved");
      setTimeout(() => {
        setOpen(false);
        setStage("idle");
        setText("");
        setEntries([]);
      }, 1800);
    } catch (e) {
      setErrorMsg(String(e));
      setStage("error");
    }
  }

  function reset() {
    setStage("idle");
    setEntries([]);
    setErrorMsg("");
  }

  function entryLabel(e: ParsedEntry) {
    const parts: string[] = [e.exercise];
    if (e.set_type) parts.push(`(${e.set_type})`);
    if (e.reps != null) parts.push(`${e.reps} reps`);
    if (e.weight_lb != null) parts.push(`@ ${e.weight_lb} lb`);
    if (e.weight_each_db_lb != null) parts.push(`${e.weight_each_db_lb} lb/ea`);
    if (e.duration_min != null) parts.push(`${e.duration_min} min`);
    if (e.distance_km != null) parts.push(`${e.distance_km} km`);
    return parts.join(" ");
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-green/15 border border-accent-green/30 text-accent-green text-sm font-semibold hover:bg-accent-green/25 transition-all"
      >
        <span className="text-base">＋</span>
        Log Workout
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white text-sm">
                  Log Workout
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Describe in plain English → AI structures it for you
                </p>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="text-slate-500 hover:text-slate-300 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Text input */}
              {stage !== "saved" && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  placeholder={`Example:\n"Bench press: bar × 12 warmup, then 94 lb × 8 for 3 sets. Incline DB 35 lb × 10 × 3. Pull-ups: 4 reps × 3 sets. Then 1 min plank."`}
                  className="w-full resize-none bg-surface-hover border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-blue/50 leading-relaxed"
                />
              )}

              {/* Error */}
              {stage === "error" && (
                <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-accent-red text-xs space-y-1">
                  <p className="font-semibold">Something went wrong</p>
                  <p>{errorMsg}</p>
                  <button onClick={reset} className="underline mt-1">
                    Try again
                  </button>
                </div>
              )}

              {/* Parsing indicator */}
              {stage === "parsing" && (
                <div className="text-xs text-accent-blue animate-pulse text-center py-2">
                  🧠 Parsing workout…
                </div>
              )}

              {/* Preview */}
              {stage === "preview" && entries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 font-medium">
                    {entries.length} entries parsed — review before saving:
                  </p>
                  <div className="bg-surface-hover border border-surface-border rounded-xl divide-y divide-surface-border max-h-52 overflow-y-auto">
                    {entries.map((e, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-medium text-white">
                            {entryLabel(e)}
                          </div>
                          {e.variant_or_details && (
                            <div className="text-[10px] text-slate-500">
                              {e.variant_or_details}
                            </div>
                          )}
                          {e.notes && (
                            <div className="text-[10px] text-slate-600 italic">
                              {e.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-600 shrink-0">
                          {e.date}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Saved confirmation */}
              {stage === "saved" && (
                <div className="text-center py-4 space-y-1">
                  <div className="text-3xl">✅</div>
                  <p className="text-sm font-semibold text-accent-green">
                    Saved to training log!
                  </p>
                  <p className="text-xs text-slate-500">
                    Reload the page to see updated data.
                  </p>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            {stage !== "saved" && (
              <div className="px-5 py-4 border-t border-surface-border flex gap-2 justify-end">
                {stage === "idle" || stage === "error" ? (
                  <button
                    onClick={handleParse}
                    disabled={!text.trim()}
                    className="px-4 py-2 rounded-xl bg-accent-blue/20 border border-accent-blue/40 text-accent-blue text-sm font-semibold hover:bg-accent-blue/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Parse with AI →
                  </button>
                ) : stage === "preview" ? (
                  <>
                    <button
                      onClick={reset}
                      className="px-4 py-2 rounded-xl bg-surface-hover border border-surface-border text-slate-400 text-sm hover:text-slate-200 transition-all"
                    >
                      Re-parse
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 rounded-xl bg-accent-green/20 border border-accent-green/40 text-accent-green text-sm font-semibold hover:bg-accent-green/30 transition-all"
                    >
                      Save {entries.length} entries
                    </button>
                  </>
                ) : stage === "saving" ? (
                  <span className="text-xs text-accent-green animate-pulse px-2">
                    Saving…
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
