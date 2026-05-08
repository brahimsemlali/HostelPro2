import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AppLogoProps {
  size?: number
  className?: string
}

/**
 * Sweet Reservation brand icon — uses the real app icon image.
 * The icon already has the teal background baked in, so no wrapper bg needed.
 */
export function AppLogo({ size = 36, className }: AppLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt="Sweet Reservation"
      width={size}
      height={size}
      className={cn('flex-shrink-0 object-cover', className)}
      priority
    />
  )
}
