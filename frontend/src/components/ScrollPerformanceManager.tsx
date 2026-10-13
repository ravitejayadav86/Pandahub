"use client";

import { useEffect } from "react";

/**
 * Pauses non-essential decorative CSS loops during native scrolling. This runs
 * once at the app root and never updates React state from a scroll event.
 */
export default function ScrollPerformanceManager() {
  useEffect(() => {
    const root = document.documentElement;
    let resumeTimer: number | null = null;
    let isScrolling = false;

    const onScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        root.classList.add("is-scrolling");
      }

      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        resumeTimer = null;
        isScrolling = false;
        root.classList.remove("is-scrolling");
      }, 180);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
      root.classList.remove("is-scrolling");
    };
  }, []);

  return null;
}
