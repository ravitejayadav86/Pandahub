/**
 * PandaHub UI shimmer states.
 * Server-compatible, no timers, listeners, images or third-party animation runtime.
 * Content-matched layouts reduce movement when fetched data appears.
 */
import type { CSSProperties, ReactNode } from 'react';

export type SkeletonVariant =
  | 'dashboard' | 'grid' | 'list' | 'table' | 'repo'
  | 'profile' | 'form' | 'editor' | 'detail';

type Size = CSSProperties['width'];
export function SkeletonBlock({
  width = '100%', height = 14, radius = 8, className = '',
}: { width?: Size; height?: number; radius?: number; className?: string }) {
  return <span aria-hidden="true" className={`ph-sk-block ${className}`}
    style={{ width, height, borderRadius: radius }} />;
}

export function SkeletonPanel({
  children, className = '',
}: { children: ReactNode; className?: string }) {
  return <div className={`ph-sk-panel ${className}`} data-ph-shimmer="true" aria-hidden="true">{children}</div>;
}

function Lines({ count = 3, last = '64%' }: { count?: number; last?: Size }) {
  return <div className="ph-sk-lines">{Array.from({ length: count }, (_, i) => (
    <SkeletonBlock key={i} height={i === 0 ? 15 : 12} width={i === count - 1 ? last : i % 2 ? '82%' : '96%'} />
  ))}</div>;
}

function SummaryCard() {
  return <SkeletonPanel><div className="ph-sk-row"><SkeletonBlock width={48} height={48} radius={14}/><div className="ph-sk-grow"><SkeletonBlock width="56%" /><SkeletonBlock width="36%" height={22}/></div></div></SkeletonPanel>;
}

function ListRows({ rows = 5 }: { rows?: number }) {
  return <SkeletonPanel className="ph-sk-list">{Array.from({ length: rows }, (_, i) => (
    <div className="ph-sk-list-row" key={i}><SkeletonBlock width={38} height={38} radius={12}/><div className="ph-sk-grow"><SkeletonBlock width={i % 2 ? '65%' : '85%'} height={15} /><SkeletonBlock width="45%" height={11}/></div><SkeletonBlock width={58} height={22} radius={12}/></div>
  ))}</SkeletonPanel>;
}

function CardGrid({ count = 6 }: { count?: number }) {
  return <div className="ph-sk-grid">{Array.from({ length: count }, (_, i) => (
    <SkeletonPanel key={i}><div className="ph-sk-row ph-sk-mb"><SkeletonBlock width={42} height={42} radius={12}/><SkeletonBlock width="56%" height={19}/></div><Lines count={3}/><div className="ph-sk-row ph-sk-footer"><SkeletonBlock width="32%"/><SkeletonBlock width="23%"/></div></SkeletonPanel>
  ))}</div>;
}

function FormSkeleton() {
  return <SkeletonPanel className="ph-sk-form"><SkeletonBlock width="52%" height={23}/><SkeletonBlock width="72%" height={12}/>{Array.from({ length: 3 }, (_, i) => <div className="ph-sk-field" key={i}><SkeletonBlock width="27%" height={12}/><SkeletonBlock height={44} radius={12}/></div>)}<SkeletonBlock height={43} radius={12}/></SkeletonPanel>;
}

function TableSkeleton() {
  return <SkeletonPanel className="ph-sk-table"><div className="ph-sk-row ph-sk-mb"><SkeletonBlock width="38%" height={21}/><SkeletonBlock width={110} height={32}/></div>{Array.from({ length: 6 }, (_, i) => <div className="ph-sk-table-row" key={i}><SkeletonBlock width="34%" height={16}/><SkeletonBlock width="24%" height={14}/><SkeletonBlock width="18%" height={14}/><SkeletonBlock width={38} height={20}/></div>)}</SkeletonPanel>;
}

export function InlineSkeleton({ label = 'Loading content', compact = false }: { label?: string; compact?: boolean }) {
  return <div role="status" aria-label={label} className={`ph-sk-inline ${compact ? 'ph-sk-inline-sm' : ''}`} data-ph-shimmer="true">
    <span className="sr-only">{label}</span>
    <SkeletonBlock width={compact ? 32 : 160} height={compact ? 10 : 14}/>
    {!compact && <><SkeletonBlock width={240} height={11}/><SkeletonBlock width={110} height={11}/></>}
  </div>;
}

export default function PageSkeleton({ variant = 'grid', label = 'Loading content' }: { variant?: SkeletonVariant; label?: string }) {
  const table = variant === 'table';
  const repo = variant === 'repo' || variant === 'list' || variant === 'detail';
  const form = variant === 'form';
  return <main role="status" aria-label={label} aria-busy="true" className="ph-sk-page">
    <span className="sr-only">{label}</span>
    <div className="ph-sk-heading"><SkeletonBlock width={variant === 'dashboard' ? '26%' : '38%'} height={30} radius={10}/><SkeletonBlock width="58%" height={14}/></div>
    {variant === 'dashboard' ? <><div className="ph-sk-grid ph-sk-stats"><SummaryCard/><SummaryCard/><SummaryCard/></div><div className="ph-sk-two"><ListRows/><CardGrid count={2}/></div></> : null}
    {variant === 'grid' ? <CardGrid/> : null}
    {repo ? <><div className="ph-sk-toolbar"><SkeletonBlock width={154} height={36}/><SkeletonBlock width={108} height={36}/></div><ListRows rows={variant === 'detail' ? 3 : 6}/></> : null}
    {table ? <TableSkeleton/> : null}
    {form ? <FormSkeleton/> : null}
    {variant === 'editor' ? <div className="ph-sk-editor"><SkeletonPanel><SkeletonBlock width="47%" height={18}/><div className="ph-sk-editor-area"><Lines count={7} last="28%" /></div></SkeletonPanel><SkeletonPanel><SkeletonBlock width="62%" height={18}/><Lines count={4}/></SkeletonPanel></div> : null}
    {variant === 'profile' ? <><SkeletonPanel><div className="ph-sk-row"><SkeletonBlock width={82} height={82} radius={40}/><div className="ph-sk-grow"><SkeletonBlock width="50%" height={22}/><SkeletonBlock width="70%" height={13}/><SkeletonBlock width="40%" height={13}/></div></div></SkeletonPanel><CardGrid count={3}/></> : null}
  </main>;
}
