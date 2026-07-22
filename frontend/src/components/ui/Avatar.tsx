"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: "sm" | "md" | "lg" | "xl"
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)

    const sizeClasses = {
      sm: "w-6 h-6 text-[10px]",
      md: "w-8 h-8 text-xs",
      lg: "w-10 h-10 text-sm",
      xl: "w-14 h-14 text-base",
    }

    const initials = fallback || alt?.slice(0, 2).toUpperCase() || "??"

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full font-medium shadow-sm ring-1 ring-slate-900/5",
          "bg-slate-100 text-slate-600 items-center justify-center dark:bg-slate-800 dark:text-slate-300",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt || "Avatar"}
            className="aspect-square h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export { Avatar }
