import { getUserData } from "@/lib/data";
import MarkdownRender from "@/components/MarkdownRender";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PlanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const db = getUserData(session.userId);
  const content = db.readMarkdown(db.findActivePlanFile(new Date()));
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h1 className="font-semibold text-white text-sm">2-Week Plan</h1>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-medium">
          Feb 19 → Mar 4
        </span>
      </div>
      <div className="px-4 py-4">
        <MarkdownRender content={content} />
      </div>
    </div>
  );
}
