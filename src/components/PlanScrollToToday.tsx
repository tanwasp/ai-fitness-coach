"use client";

import { useEffect } from "react";

/**
 * Scrolls the plan page to today's section.
 * Retries until the element appears (ReactMarkdown renders async on the client).
 */
export default function PlanScrollToToday({ todayId }: { todayId: string }) {
  useEffect(() => {
    let attempts = 0;
    const MAX = 20; // up to ~1 second of retries

    function tryScroll() {
      const el = document.getElementById(todayId);
      if (el) {
        // Offset for the sticky header (~60px)
        const top = el.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: "smooth" });
        return;
      }
      if (++attempts < MAX) {
        setTimeout(tryScroll, 50);
      }
    }

    // First attempt after a frame to let ReactMarkdown commit its DOM
    requestAnimationFrame(() => setTimeout(tryScroll, 0));
  }, [todayId]);

  return null;
}
