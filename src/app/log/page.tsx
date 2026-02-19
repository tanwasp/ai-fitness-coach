import { getUserData } from "@/lib/data";
import LogClient from "@/components/LogClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const entries = getUserData(session.userId).readLog();
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📝</span>
          <h1 className="font-semibold text-white text-sm">Training Log</h1>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20 font-medium">
          {entries.length} rows
        </span>
      </div>
      <div className="px-4 py-4">
        <LogClient entries={entries} />
      </div>
    </div>
  );
}
