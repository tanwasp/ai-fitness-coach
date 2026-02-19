import { readMarkdown } from "@/lib/data";
import MarkdownRender from "@/components/MarkdownRender";

export default function PlanPage() {
  const content = readMarkdown(
    "coach/two-week-plan-2026-02-19_to_2026-03-04.md",
  );
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
