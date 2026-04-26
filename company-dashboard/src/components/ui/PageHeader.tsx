interface Props {
  /** spec: <h1 className="page-heading"> に入る。<strong> タグで accent 強調可 */
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

/** spec準拠: design-spec.html の .page-heading (32px / weight 300 / accent strong) + .page-sub */
export function PageHeader({ title, description, actions }: Props) {
  if (actions) {
    return (
      <div className="page-meta-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-heading">{title}</h1>
          {description && <p className="page-sub" style={{ marginBottom: 0 }}>{description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>
      </div>
    )
  }
  return (
    <>
      <h1 className="page-heading">{title}</h1>
      {description && <p className="page-sub">{description}</p>}
    </>
  )
}
