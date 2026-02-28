"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";

/**
 * Extracts a stable anchor id from a plan-day heading like
 * "Thu Feb 19 — Quality run…"  →  "plan-thu-feb-19"
 */
function headingToId(text: string): string | undefined {
  const m = text.match(/([A-Z][a-z]{2})\s+([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (!m) return undefined;
  return `plan-${m[1].toLowerCase()}-${m[2].toLowerCase()}-${m[3]}`;
}

function extractText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children))
    return (children as ReactNode[]).map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText(
      (children as { props?: { children?: ReactNode } }).props?.children,
    );
  }
  return "";
}

export default function MarkdownRender({ content }: { content: string }) {
  return (
    <div className="prose-fit">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2({ children }) {
            const text = extractText(children as ReactNode);
            const id = headingToId(text);
            return <h2 id={id}>{children}</h2>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
