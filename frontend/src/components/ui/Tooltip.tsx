"use client"

import * as React from "react"

export interface TooltipProps {
  content: string
  children: React.ReactNode
}

/**
 * A simple wrapper component that applies the `data-tooltip` attribute 
 * to its child, leveraging the global CSS tooltip styling.
 */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="inline-flex" data-tooltip={content}>
      {children}
    </div>
  )
}
