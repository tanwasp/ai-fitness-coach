import { getUserData } from "@/lib/data";
import { extractTodaySection } from "@/lib/parsePlan";
import MarkdownRender from "@/components/MarkdownRender";
import WorkoutLogger from "@/components/WorkoutLogger";
import type { LogEntry } from "@/lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function SessionCard({ entry }: { entry: LogEntry }) {
  const weight = entry.weight_lb
    ? `${entry.weight_lb} lb`
    : entry.weight_each_db_lb
      ? `${entry.weight_each_db_lb} lb each`
      : null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {entry.exercise}
        </div>
        {entry.variant_or_details && (
          <div className="text-xs text-slate-500 truncate">
            {entry.variant_or_details}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0 flex-wrap justify-end">
        {entry.set_type && (
          <span className="px-1.5 py-0.5 rounded bg-surface-hover uppercase tracking-wide text-[10px] font-semibold text-slate-500">
            {entry.set_type}
          </span>
        )}
        {entry.reps != null && <span>{entry.reps} reps</span>}
        {weight && (
          <span className="text-accent-blue font-semibold">{weight}</span>
        )}
        {entry.duration_min != null && <span>{entry.duration_min} min</span>}
        {entry.distance_km != null && <span>{entry.distance_km} km</span>}
        {entry.notes && (
          <span className="text-slate-600 italic hidden sm:inline max-w-[160px] truncate">
            {entry.notes}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function TodayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const db = getUserData(session.userId);
  if (!db.hasProfile()) redirect("/onboarding");

  const today = new Date();
  const planMd = db.readMarkdown(db.findActivePlanFile(today));
  const allEntries = db.readLog();
  const profile = db.readUserProfile()!;
  const DASHBOARD_GOALS = profile.goals;

  const { heading, body, found } = extractTodaySection(planMd, today);

  const todayStr = today.toISOString().slice(0, 10);
  const todayEntries = allEntries.filter((e) => e.date === todayStr);

  const dayName = DAYS[today.getDay()];
  const monthName = MONTHS[today.getMonth()];
  const formattedDate = `${dayName}, ${monthName} ${today.getDate()}`;

  // Stats from most recent prior sessions
  const latestBench = allEntries
    .filter(
      (e) =>
        e.exercise === "Bench Press" && e.set_type === "work" && e.weight_lb,
    )
    .at(-1);
  const latestRun = allEntries
    .filter((e) => e.duration_min != null && e.session_type === "Conditioning")
    .at(-1);

  return (
    <div className="space-y-4">
      {/* Date header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">{formattedDate}</h1>
          <p className="text-sm text-slate-500">
            Here&apos;s your plan for today
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-medium">
            Feb – June 2026
          </span>
        </div>
      </div>

      {/* Goals bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DASHBOARD_GOALS.map(({ label, value, current, color }) => (
          <div
            key={label}
            className="bg-surface-card border border-surface-border rounded-xl p-3"
          >
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              {label}
            </div>
            <div className={`text-sm font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500">Now: {current}</div>
          </div>
        ))}
      </div>

      {/* Today's plan */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
          <span className="text-base">📋</span>
          <h2 className="font-semibold text-white text-sm">
            {found ? heading : "Today's Training"}
          </h2>
          {!found && (
            <span className="ml-auto text-xs text-slate-500 italic">
              No plan entry matched today — check dates in the plan file.
            </span>
          )}
        </div>
        <div className="px-4 py-3">
          {found ? (
            <MarkdownRender content={body} />
          ) : (
            <p className="text-sm text-slate-400">
              Today is outside the current two-week plan window. Generate a new
              plan or browse the{" "}
              <a href="/plan" className="text-accent-blue underline">
                2-Week Plan
              </a>{" "}
              tab.
            </p>
          )}
        </div>
      </div>

      {/* Today's logged work */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <h2 className="font-semibold text-white text-sm">Logged today</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {todayEntries.length === 0
                ? "Nothing logged yet"
                : `${todayEntries.length} entries`}
            </span>
            <WorkoutLogger />
          </div>
        </div>
        <div className="px-4">
          {todayEntries.length === 0 ? (
            <p className="py-4 text-sm text-slate-500 italic">
              Add rows with today&apos;s date to{" "}
              <code className="text-slate-400">training_log.csv</code> and
              refresh.
            </p>
          ) : (
            todayEntries.map((e, i) => <SessionCard key={i} entry={e} />)
          )}
        </div>
      </div>

      {/* Recent context */}
      {(latestBench || latestRun) && (
        <div className="bg-surface-card border border-surface-border rounded-2xl px-4 py-3">
          <h2 className="font-semibold text-white text-sm mb-2 flex items-center gap-2">
            <span>⚡</span> Recent context
          </h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            {latestBench && (
              <span>
                Last bench work set:{" "}
                <span className="text-accent-blue font-semibold">
                  {latestBench.weight_lb} lb
                </span>
                {latestBench.reps != null && ` × ${latestBench.reps}`} on{" "}
                {latestBench.date}
              </span>
            )}
            {latestRun && (
              <span>
                Last conditioning:{" "}
                <span className="text-accent-green font-semibold">
                  {latestRun.duration_min} min
                </span>{" "}
                {latestRun.session_name} on {latestRun.date}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
