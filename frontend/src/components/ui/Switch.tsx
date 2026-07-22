"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string | React.ReactNode
  description?: string
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const generatedId = React.useId()
    const switchId = id || generatedId

    return (
      <div className="flex items-center gap-3">
        <label htmlFor={switchId} className={cn("toggle-switch shrink-0", className)}>
          <input
            id={switchId}
            type="checkbox"
            ref={ref}
            {...props}
          />
          <span className="track" />
          <span className="thumb" />
        </label>
        {(label || description) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <label 
                htmlFor={switchId} 
                className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none"
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
