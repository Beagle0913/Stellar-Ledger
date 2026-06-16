import React from 'react'

interface LinkButtonProps {
  children: React.ReactNode
  onClick: () => void
  className?: string
  title?: string
}

/** Inline text button styled like a link — keyboard and screen-reader accessible. */
export function LinkButton({ children, onClick, className, title }: LinkButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`link-btn${className ? ` ${className}` : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}
