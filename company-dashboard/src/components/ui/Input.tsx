import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', id, ...props }: Props) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div>
      {label && <label className="form-label" htmlFor={inputId}>{label}</label>}
      <input id={inputId} className={`input ${className}`.trim()} {...props} />
    </div>
  )
}
