import type { HTMLAttributes, ReactNode } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  glow?: boolean
}

export function Card({ children, glow, className = '', ...props }: Props) {
  const cls = `card${glow ? ' card-glow' : ''} ${className}`.trim()
  return <div className={cls} {...props}>{children}</div>
}
