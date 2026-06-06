export const nativeMotion = {
  duration: {
    instant: 0.08,
    fast: 0.14,
    normal: 0.22,
    sheet: 0.32
  },
  easing: {
    standard: [0.23, 1, 0.32, 1],
    emphasized: [0.32, 0.72, 0, 1],
    exit: [0.4, 0, 1, 1]
  },
  spring: {
    snappy: {
      type: 'spring',
      stiffness: 520,
      damping: 38,
      mass: 0.8
    },
    soft: {
      type: 'spring',
      stiffness: 320,
      damping: 34,
      mass: 1
    },
    sheet: {
      type: 'spring',
      stiffness: 360,
      damping: 42,
      mass: 1
    }
  },
  press: {
    scale: 0.97,
    subtleScale: 0.985,
    hoverLift: -1
  }
} as const

export type NativeMotion = typeof nativeMotion
