"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  defaultTab?: string;
  className?: string;
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const instanceId = React.useId();
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selectedTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  const handleTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key) || tabs.length === 0) return;
    event.preventDefault();
    const index = Math.max(0, tabs.findIndex((tab) => tab.id === selectedTab?.id));
    const next = event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[next];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={cn("ph-premium-tabs flex w-full flex-col", className)}>
      <div className="ph-premium-tablist" role="tablist" aria-label="Content views" onKeyDown={handleTabsKeyDown}>
        {tabs.map((tab, index) => {
          const isActive = selectedTab?.id === tab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`${instanceId}-tab-${index}`}
              type="button"
              role="tab"
              aria-controls={`${instanceId}-panel`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={cn("ph-premium-tab", isActive && "ph-premium-tab-active")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${instanceId}-panel`}
        role="tabpanel"
        aria-labelledby={`${instanceId}-tab-${Math.max(0, tabs.findIndex((tab) => tab.id === selectedTab?.id))}`}
        tabIndex={0}
        className="ph-premium-tab-panel"
      >
        {selectedTab?.content}
      </div>
    </div>
  );
}
