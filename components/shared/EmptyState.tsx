import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Action {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'outline'
}

interface EmptyStateProps {
  icon: LucideIcon
  /** Tailwind class(es) applied to the icon itself */
  iconColor?: string
  /** Tailwind class(es) applied to the rounded square behind the icon */
  iconBg?: string
  title: string
  description?: string
  action?: Action
  secondaryAction?: Action
  className?: string
}

function ActionButton({ action }: { action: Action }) {
  const cls = cn(
    'h-11',
    action.variant === 'outline' ? '' : 'bg-[#0F6E56] hover:bg-[#0c5a46]',
  )
  if (action.href) {
    return (
      <Link href={action.href}>
        <Button variant={action.variant ?? 'default'} className={cls}>
          {action.label}
        </Button>
      </Link>
    )
  }
  return (
    <Button variant={action.variant ?? 'default'} className={cls} onClick={action.onClick}>
      {action.label}
    </Button>
  )
}

export function EmptyState({
  icon: Icon,
  iconColor = 'text-muted-foreground',
  iconBg = 'bg-muted',
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0',
          iconBg,
        )}
      >
        <Icon className={cn('w-8 h-8', iconColor)} />
      </div>

      <h3 className="font-medium text-base mb-2 max-w-xs">{title}</h3>

      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {(action ?? secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && <ActionButton action={action} />}
          {secondaryAction && <ActionButton action={secondaryAction} />}
        </div>
      )}
    </div>
  )
}
