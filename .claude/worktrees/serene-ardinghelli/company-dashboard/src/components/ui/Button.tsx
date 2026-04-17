import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'default' | 'sm'
}

const variantClass = { primary: 'btn-p', ghost: 'btn-g', danger: 'btn-d' }

export function Button({ variant = 'primary', size = 'default', className = '', ...props }: Props) {
  const cls = `btn ${variantClass[variant]}${size === 'sm' ? ' btn-sm' : ''} ${className}`.trim()
  return <button className={cls} {...props} />
}
