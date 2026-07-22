"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsProps {
  tabs: { id: string; label: string; content: React.ReactNode }[]
  defaultTab?: string
  className?: string
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id)

  const activeContent = React.useMemo(() => {
    return tabs.find((t) => t.id === activeTab)?.content
  }, [activeTab, tabs])

  return (
    <div className={cn("flex flex-col w-full", className)}>
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "nav-link pb-3 px-1 text-sm outline-none",
                isActive && "active"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className="pt-4 animate-fade-in-up">
        {activeContent}
      </div>
    </div>
  )
}
