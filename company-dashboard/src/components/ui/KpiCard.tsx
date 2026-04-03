interface Props {
  value: string | number
  label: string
  status?: 'good' | 'warn' | 'bad'
}

export function KpiCard({ value, label, status }: Props) {
  return (
    <div className="card kpi">
      <div className={`kpi-val${status ? ` ${status}` : ''}`}>{value}</div>
      <div className="kpi-lbl">{label}</div>
    </div>
  )
}
