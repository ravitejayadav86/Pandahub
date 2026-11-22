import * as React from "react"
import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { }

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton skeleton-shimmer", className)}
      {...props}
    />
  )
}

/** Card container with shimmer placeholder lines */
function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3 rounded" />
          <Skeleton className="h-3 w-1/4 rounded" />
        </div>
      </div>
      <div className="space-y-2 mb-6">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-4/5 rounded" />
        <Skeleton className="h-3.5 w-2/3 rounded" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]/50">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  )
}

/** Repository card skeleton matching Dashboard & Explore repository layouts */
function SkeletonRepoCard({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-sm flex flex-col justify-between",
        className
      )}
      {...props}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className="h-4 w-36 rounded" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full shrink-0" />
        </div>
        <div className="space-y-1.5 mb-5">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-4 pt-3 border-t border-[var(--border-color)]/40 text-xs">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-8 rounded" />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  )
}

/** Activity event feed item skeleton */
function SkeletonActivityItem({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-xl border border-[var(--border-color)]/60 bg-[var(--bg-secondary)]/70",
        className
      )}
      {...props}
    >
      <Skeleton className="h-9 w-9 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-3.5 w-16 rounded" />
          <Skeleton className="h-3 w-12 rounded ml-auto" />
        </div>
        <Skeleton className="h-3 w-4/5 rounded" />
        <div className="p-3 rounded-lg border border-[var(--border-color)]/40 bg-[var(--glass-bg-1)]/80 space-y-1.5 mt-2">
          <Skeleton className="h-3 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      </div>
    </div>
  )
}

/** Startup card skeleton matching /startups grid */
function SkeletonStartupCard({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden shadow-sm",
        className
      )}
      {...props}
    >
      <div className="h-20 bg-[var(--glass-bg-1)] p-5 flex items-center justify-between border-b border-[var(--border-color)]/60">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="p-5 space-y-3">
        <Skeleton className="h-4 w-2/5 rounded" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]/40">
          <Skeleton className="h-3.5 w-16 rounded" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** List item skeleton for commits, pulls, and file tables */
function SkeletonListItem({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 p-4 border-b border-[var(--border-color)]/50 bg-[var(--bg-secondary)]/40",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-3.5 w-2/5 rounded" />
          <Skeleton className="h-2.5 w-1/4 rounded" />
        </div>
      </div>
      <Skeleton className="h-6 w-16 rounded-lg shrink-0" />
    </div>
  )
}

/** Complete profile layout skeleton for /[org] page */
function SkeletonProfile({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("w-full flex flex-col md:flex-row gap-8 py-8", className)} {...props}>
      {/* Profile Sidebar */}
      <div className="w-full md:w-72 shrink-0 space-y-5">
        <Skeleton className="w-40 h-40 md:w-56 md:h-56 rounded-full mx-auto md:mx-0 border-4 border-[var(--border-color)]" />
        <div className="space-y-2 text-center md:text-left">
          <Skeleton className="h-6 w-36 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-4/5 rounded" />
        </div>
        <div className="flex items-center gap-4 pt-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>
      {/* Main Content Area */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonRepoCard />
          <SkeletonRepoCard />
          <SkeletonRepoCard />
          <SkeletonRepoCard />
        </div>
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonRepoCard,
  SkeletonActivityItem,
  SkeletonStartupCard,
  SkeletonListItem,
  SkeletonProfile,
}
