"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The visual variant of the button. Maps to global.css classes. */
  variant?: "primary" | "glass" | "danger" | "icon" | "ghost"
  /** Includes the ripple click effect. */
  ripple?: boolean
  /** Shows a loading spinner and disables the button. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ripple = true, loading = false, disabled, children, ...props }, ref) => {
    
    // Maps variant to the specific CSS classes defined in globals.css
    const variantClasses = {
      primary: "btn-primary px-4 py-2",
      glass: "btn-glass px-4 py-2",
      danger: "btn-danger px-4 py-2",
      icon: "btn-icon w-10 h-10",
      ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors",
    }

    // Ripple click handler
    const handleRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
      const button = e.currentTarget
      const rect = button.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      button.style.setProperty("--mouse-x", `${x}px`)
      button.style.setProperty("--mouse-y", `${y}px`)
      props.onClick?.(e)
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        onClick={ripple ? handleRipple : props.onClick}
        className={cn(
          "inline-flex items-center justify-center gap-2 outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          variantClasses[variant],
          ripple && "btn-ripple",
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
