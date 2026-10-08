import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "blue" | "green" | "purple" | "amber" | "red"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-[#18181b] text-zinc-100 border border-[#333333]",
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
