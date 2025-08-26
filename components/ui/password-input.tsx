import * as React from 'react'
import { useState } from 'react'

import { Eye, EyeOff } from 'lucide-react'

import { Input, InputProps } from '@/components/ui/input'

import { Button } from './button'

const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'password', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    return (
      <div className="relative flex">
        <Input
          type={showPassword ? 'text' : type}
          className={className}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-full px-3 py-2 hover:bg-transparent absolute right-0 flex items-center justify-center"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
