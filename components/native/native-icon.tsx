import type { SVGProps } from 'react'

import { nativeIconMap, type NativeIconName } from '@/lib/native/icon-map'
import { cn } from '@/lib/utils'

export interface NativeIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: NativeIconName
  size?: number | string
}

export function NativeIcon({
  name,
  className,
  size,
  width,
  height,
  strokeWidth = 1.75,
  ...props
}: NativeIconProps) {
  const Icon = nativeIconMap[name]
  const hasAccessibleName = typeof props['aria-label'] === 'string'

  return (
    <Icon
      aria-hidden={hasAccessibleName ? undefined : true}
      className={cn('shrink-0', className)}
      focusable="false"
      height={height ?? size}
      role={hasAccessibleName ? 'img' : undefined}
      strokeWidth={strokeWidth}
      width={width ?? size}
      {...props}
    />
  )
}
