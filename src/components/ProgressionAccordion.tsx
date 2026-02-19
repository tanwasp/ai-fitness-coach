"use client";

import { useState } from "react";
import MarkdownRender from "./MarkdownRender";

export interface ProgressionSection {
  /** Full heading text, e.g. "Pull-up progression (2–3×/week)" */
  title: string;
  body: string;
}

const SECTION_META: Record<
  string,
  { icon: string; color: string; defaultOpen: boolean }
> = {
  "pull-up": { icon: "🔼", color: "text-accent-purple", defaultOpen: false },
  bench: { icon: "🏋️", color: "text-accent-blue", defaultOpen: false },
  running: { icon: "🏃", color: "text-accent-green", defaultOpen: false },
  lower: { icon: "🦵", color: "text-accent-orange", defaultOpen: false },
  core: { icon: "💪", color: "text-accent-yellow", defaultOpen: false },
  "body compos": { icon: "🥗", color: "text-accent-red", defaultOpen: false },
  goal: { icon: "🎯", color: "text-accent-blue", defaultOpen: false },
  global: { icon: "⚙️", color: "text-slate-400", defaultOpen: false },
};

function getMeta(title: string) {
  const lower = title.toLowerCase();
  for (const [key, meta] of Object.entries(SECTION_META)) {
    if (lower.includes(key)) return meta;
  }
  return { icon: "📌", color: "text-slate-400", defaultOpen: false };
}

function AccordionItem({ section }: { section: ProgressionSection }) {
  const meta = getMeta(section.title);
  const [open, setOpen] = useState(meta.defaultOpen);

  return (
    <div className="border border-surface-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-surface-card hover:bg-surface-hover transition-colors text-left"
      >
        <span className="text-lg leading-none shrink-0">{meta.icon}</span>
        <span className={`text-sm font-semibold flex-1 ${meta.color}`}>
          {section.title}
        </span>
        <span
          className="text-slate-500 text-sm shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="px-4 py-3 bg-surface border-t border-surface-border">
          <MarkdownRender content={section.body} />
        </div>
      )}
    </div>
  );
}

export default function ProgressionAccordion({
  sections,
}: {
  sections: ProgressionSection[];
}) {
  const [allOpen, setAllOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-1">
        <button
          onClick={() => setAllOpen((o) => !o)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      {sections.map((s, i) => (
        <AccordionItem key={i} section={s} />
      ))}
    </div>
  );
}
