import { readMarkdown } from "@/lib/data";
import ProgressionAccordion, {
  type ProgressionSection,
} from "@/components/ProgressionAccordion";

function parseProgressionSections(md: string): ProgressionSection[] {
  const lines = md.split("\n");
  const sections: ProgressionSection[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          body: currentLines.join("\n").trim(),
        });
      }
      currentTitle = line.replace(/^##\s*/, "").trim();
      currentLines = [];
    } else if (currentTitle) {
      currentLines.push(line);
    }
  }

  if (currentTitle) {
    sections.push({
      title: currentTitle,
      body: currentLines.join("\n").trim(),
    });
  }

  return sections;
}

export default function ProgressionPage() {
  const content = readMarkdown("coach/progression.md");
  const sections = parseProgressionSections(content);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Progression Rules</h1>
          <p className="text-sm text-slate-500">
            Your plan to hit all June goals
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-medium">
          Feb – June 2026
        </span>
      </div>
      <ProgressionAccordion sections={sections} />
    </div>
  );
}
