"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import PandaLoader from "@/components/ui/PandaLoader"

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
          "inline-flex items-center justify-center gap-2 outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer btn-motion-blur",
          variantClasses[variant],
          ripple && "btn-ripple",
          className
        )}
        {...props}
      >
        {loading && <PandaLoader size="xs" glow={false} className="-ml-1 mr-1.5" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
