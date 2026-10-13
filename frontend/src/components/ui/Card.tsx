import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass-panel" | "glass-card" | "default"
  interactive?: "lift" | "glow" | "none"
}

const variantClasses: Record<NonNullable<CardProps["variant"]>, string> = {
  "glass-panel": "glass-panel rounded-2xl",
  "glass-card": "glass-card rounded-2xl",
  default:
    "bg-[#0d0d0f] border border-[#27272a] shadow-sm rounded-xl text-white transition-colors duration-200 hover:border-[#3f3f46]",
}

const interactiveClasses: Record<NonNullable<CardProps["interactive"]>, string> = {
  // Keep interactions CSS-based so cards do not mount Framer Motion components.
  lift: "cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0",
  glow: "cursor-pointer transition-colors duration-150 hover:border-white/20",
  none: "",
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "glass-card", interactive = "none", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(variantClasses[variant], interactiveClasses[interactive], className)}
      {...props}
    />
  ),
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardContent, CardFooter }
