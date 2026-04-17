interface GridProps {
  cols?: number
  count?: number
  className?: string
}

export function SkeletonGrid({ cols = 3, count = 6, className = 'skeleton-card' }: GridProps) {
  return (
    <div className={`g${cols}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skeleton ${className}`} />
      ))}
    </div>
  )
}

interface RowsProps {
  count?: number
}

export function SkeletonRows({ count = 5 }: RowsProps) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  )
}
