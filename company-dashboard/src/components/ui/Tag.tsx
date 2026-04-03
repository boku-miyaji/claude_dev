interface Props {
  children: string
  variant?: 'high' | 'normal' | 'low' | 'open' | 'done' | 'in_progress' | 'company'
}

export function Tag({ children, variant = 'normal' }: Props) {
  return <span className={`tag tag-${variant}`}>{children}</span>
}
