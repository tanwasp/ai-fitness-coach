import { getUserData } from "@/lib/data";
import TrendsClient from "@/components/TrendsClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TrendsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const db = getUserData(session.userId);
  if (!db.hasProfile()) redirect("/onboarding");
  const entries = db.readLog();
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h1 className="font-semibold text-white text-sm">Trends</h1>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-accent-orange/10 text-accent-orange border border-accent-orange/20 font-medium">
          Progress over time
        </span>
      </div>
      <div className="px-4 py-4">
        <TrendsClient entries={entries} />
      </div>
    </div>
  );
}
