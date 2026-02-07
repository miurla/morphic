'use client'

import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

function IconLogo({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      fill="currentColor"
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <circle cx="128" cy="128" r="128" fill="black"></circle>
      <circle cx="102" cy="128" r="18" fill="white"></circle>
      <circle cx="154" cy="128" r="18" fill="white"></circle>
    </svg>
  )
}

function IconLogoOutline({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      fill="currentColor"
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <circle
        cx="128"
        cy="128"
        r="108"
        fill="none"
        stroke="currentColor"
        strokeWidth="24"
      ></circle>
      <circle cx="102" cy="128" r="18" fill="currentColor"></circle>
      <circle cx="154" cy="128" r="18" fill="currentColor"></circle>
    </svg>
  )
}

function IconBlinkingLogo({
  className,
  ...props
}: React.ComponentProps<'svg'>) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const blinkElements = document.querySelectorAll('.blink')
    const initialPositions = Array.from(blinkElements).map(el => ({
      cx: parseFloat(el.getAttribute('cx') || '0'),
      cy: parseFloat(el.getAttribute('cy') || '0')
    }))

    const triggerBlink = () => {
      blinkElements.forEach(el => {
        el.classList.add('animate-blink')
        setTimeout(() => {
          el.classList.remove('animate-blink')
        }, 200)
      })
    }

    const randomInterval = () => Math.random() * 8000 + 2000

    let timeoutId: ReturnType<typeof setTimeout>
    const startBlinking = () => {
      triggerBlink()
      timeoutId = setTimeout(startBlinking, randomInterval())
    }

    startBlinking()

    const handleMove = (clientX: number, clientY: number) => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        const mouseX = clientX - rect.left - rect.width / 2 - 256
        const mouseY = clientY - rect.top - rect.height / 2

        const maxMove = 60

        blinkElements.forEach((el, index) => {
          const { cx, cy } = initialPositions[index]
          const targetDx = Math.min((mouseX - cx) * 0.1, maxMove)
          const targetDy = Math.min((mouseY - cy) * 0.1, maxMove)

          let velocityX = 0
          let velocityY = 0
          const damping = 0.05

          const animate = () => {
            const currentCx = parseFloat(el.getAttribute('cx') || '0')
            const currentCy = parseFloat(el.getAttribute('cy') || '0')

            const dx = (targetDx - (currentCx - cx)) * 0.1
            const dy = (targetDy - (currentCy - cy)) * 0.1

            velocityX = velocityX * damping + dx
            velocityY = velocityY * damping + dy

            el.setAttribute('cx', (currentCx + velocityX).toString())
            el.setAttribute('cy', (currentCy + velocityY).toString())

            if (Math.abs(velocityX) > 0.1 || Math.abs(velocityY) > 0.1) {
              requestAnimationFrame(animate)
            }
          }

          requestAnimationFrame(animate)
        })
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      handleMove(event.clientX, event.clientY)
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        handleMove(event.touches[0].clientX, event.touches[0].clientY)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      fill="currentColor"
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <circle cx="128" cy="128" r="128" fill="#222"></circle>
      <ellipse
        cx="102"
        cy="128"
        rx="18"
        ry="18"
        fill="white"
        className="blink"
      ></ellipse>
      <ellipse
        cx="154"
        cy="128"
        rx="18"
        ry="18"
        fill="white"
        className="blink"
      ></ellipse>
    </svg>
  )
}

export { IconBlinkingLogo, IconLogo, IconLogoOutline }
