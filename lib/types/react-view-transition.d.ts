// React 19 ships these; @types/react 18 does not declare them yet.
import 'react'

declare module 'react' {
  type ViewTransitionClass = string | Record<string, string>

  interface ViewTransitionProps {
    children?: ReactNode
    name?: string
    default?: ViewTransitionClass
    enter?: ViewTransitionClass
    exit?: ViewTransitionClass
    share?: ViewTransitionClass
    update?: ViewTransitionClass
  }

  export const ViewTransition: (props: ViewTransitionProps) => ReactElement

  export function addTransitionType(type: string): void
}
