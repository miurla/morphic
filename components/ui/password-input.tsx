import * as React from 'react'
import { useState } from 'react'

import { Eye, EyeOff } from 'lucide-react'

import { Input, InputProps } from '@/components/ui/input'

import { Button } from './button'

const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'password', rightElement, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    return (
      <Input
        type={showPassword ? 'text' : type}
        className={className}
        ref={ref}
        {...props}
        rightElement={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        }
      />
    )
  }
)

PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
