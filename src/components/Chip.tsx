export interface ChipProps {
  label: string
  count: string
}

export function Chip({ label, count }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-chip border border-border bg-titlebar px-3 py-1 font-mono text-[15px]">
      <span className="text-muted">{label}</span>
      <strong className="font-semibold text-ink">{count}</strong>
    </span>
  )
}
