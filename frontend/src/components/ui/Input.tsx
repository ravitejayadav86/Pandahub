import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, placeholder, required, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
    
    // We use a blank placeholder if label exists to trigger the CSS :placeholder-shown trick
    const actualPlaceholder = label ? (placeholder || " ") : placeholder

    const inputElement = (
      <div className={cn("relative w-full", label && "input-group")}>
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          placeholder={actualPlaceholder}
          className={cn(
            "input-glass w-full px-4 py-2.5 text-sm transition-all",
            icon && "pl-10",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {label && (
          <label htmlFor={inputId}>
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
      </div>
    )

    if (error) {
      return (
        <div className="w-full flex flex-col gap-1.5">
          {inputElement}
          <span className="text-xs text-red-500 font-medium animate-fade-in-up">{error}</span>
        </div>
      )
    }

    return inputElement
  }
)
Input.displayName = "Input"

export { Input }
