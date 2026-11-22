import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "blue" | "green" | "purple" | "amber" | "red"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "bg-[#E8F9FF] text-zinc-100 border border-[#C4D9FF]",
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
