'use client'

import { cn } from '@/lib/utils'

/**
 * Wraps page content with a smooth fade-up entrance animation.
 * Use in any page that needs animated content load.
 */
export function PageWrapper({
  children,
  className,
  stagger = false,
}: {
  children: React.ReactNode
  className?: string
  stagger?: boolean
}) {
  return (
    <div
      className={cn('hp-fade-up', stagger && 'hp-stagger', className)}
      style={{ animationDuration: '0.4s' }}
    >
      {children}
    </div>
  )
}
