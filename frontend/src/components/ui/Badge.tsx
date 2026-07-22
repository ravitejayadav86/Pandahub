import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "blue" | "green" | "purple" | "amber" | "red"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    blue: "chip-blue",
    green: "chip-green",
    purple: "chip-purple",
    amber: "chip-amber",
    red: "chip-red",
  }

  return (
    <span
      className={cn(
        "chip", 
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
