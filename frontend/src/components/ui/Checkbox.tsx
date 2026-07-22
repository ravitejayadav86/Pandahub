"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string | React.ReactNode
  description?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const generatedId = React.useId()
    const checkboxId = id || generatedId

    return (
      <div className="flex items-start gap-3">
        <div className="flex h-5 items-center">
          <input
            id={checkboxId}
            type="checkbox"
            className={cn("checkbox-animated", className)}
            ref={ref}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {label && (
              <label 
                htmlFor={checkboxId} 
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
Checkbox.displayName = "Checkbox"

export { Checkbox }
