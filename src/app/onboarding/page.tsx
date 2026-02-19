"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const GOAL_TEMPLATES = [
  { label: "Body Weight", value: "", current: "", color: "#a78bfa" },
  { label: "Bench Press 1RM", value: "", current: "", color: "#60a5fa" },
  { label: "Squat 1RM", value: "", current: "", color: "#34d399" },
  { label: "Deadlift 1RM", value: "", current: "", color: "#fb923c" },
];

const PROFILE_TEMPLATE = `Height: 
Weight: 
Age: 
Training experience: 
Training style: strength/hypertrophy/endurance (pick one or describe)
Equipment available: 
Injuries or limitations: none
Schedule: training X days/week
Notes: `;

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [athleteProfile, setAthleteProfile] = useState(PROFILE_TEMPLATE);
  const [goals, setGoals] = useState(GOAL_TEMPLATES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateGoal(
    i: number,
    field: keyof (typeof GOAL_TEMPLATES)[0],
    val: string,
  ) {
    setGoals((prev) =>
      prev.map((g, idx) => (idx === i ? { ...g, [field]: val } : g)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          athleteProfile: athleteProfile.trim(),
          goals: goals.map((g) => ({
            label: g.label,
            value: Number(g.value) || 0,
            current: Number(g.current) || 0,
            color: g.color,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold text-white mb-1">
        Welcome! Set up your profile
      </h1>
      <p className="text-slate-400 text-sm mb-8">
        This helps the coach understand who you are and personalize your
        training.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Display name */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Tanish"
            className="w-full bg-surface-card border border-surface-border rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent-blue/60 text-sm"
          />
        </div>

        {/* Athlete profile */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">
            About you{" "}
            <span className="text-slate-500 font-normal">
              (fill in what&apos;s relevant)
            </span>
          </label>
          <textarea
            rows={10}
            value={athleteProfile}
            onChange={(e) => setAthleteProfile(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-slate-200 text-sm font-mono focus:outline-none focus:border-accent-blue/60 resize-y"
          />
        </div>

        {/* Goals */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3">
            Goals{" "}
            <span className="text-slate-500 font-normal">
              (optional — edit labels/numbers as needed)
            </span>
          </label>
          <div className="space-y-3">
            {goals.map((g, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 items-center">
                <input
                  type="text"
                  value={g.label}
                  onChange={(e) => updateGoal(i, "label", e.target.value)}
                  placeholder="Goal label"
                  className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-accent-blue/60"
                />
                <input
                  type="number"
                  value={g.current}
                  onChange={(e) => updateGoal(i, "current", e.target.value)}
                  placeholder="Current"
                  className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-accent-blue/60"
                />
                <input
                  type="number"
                  value={g.value}
                  onChange={(e) => updateGoal(i, "value", e.target.value)}
                  placeholder="Target"
                  className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-accent-blue/60"
                />
              </div>
            ))}
            <p className="text-xs text-slate-600">
              Columns: Label / Current / Target
            </p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-accent-blue text-white font-semibold text-sm hover:bg-accent-blue/80 transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save & continue →"}
        </button>
      </form>
    </div>
  );
}
