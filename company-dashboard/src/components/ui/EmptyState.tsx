interface Props {
  icon?: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon = '📭', message, actionLabel, onAction }: Props) {
  return (
    <div className="empty-state" style={{ textAlign: 'center', padding: 32, color: 'var(--text3)', fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ marginBottom: onAction ? 12 : 0 }}>{message}</div>
      {onAction && actionLabel && (
        <button className="btn btn-g btn-sm" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  )
}
