import { getUserData } from "@/lib/data";
import MarkdownRender from "@/components/MarkdownRender";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PlanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const db = getUserData(session.userId);
  if (!db.hasProfile()) redirect("/onboarding");
  const planFile = db.findActivePlanFile(new Date());
  const content = planFile ? db.readMarkdown(planFile) : "";

  // Derive date range from filename: two-week-plan-YYYY-MM-DD_to_YYYY-MM-DD.md
  const dateMatch = planFile?.match(
    /(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})/,
  );
  const planRange = dateMatch
    ? `${dateMatch[1].slice(5).replace("-", "/")} → ${dateMatch[2].slice(5).replace("-", "/")}`
    : "Current Plan";

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h1 className="font-semibold text-white text-sm">2-Week Plan</h1>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-medium">
          {planRange}
        </span>
      </div>
      <div className="px-4 py-4">
        <MarkdownRender content={content} />
      </div>
    </div>
  );
}
