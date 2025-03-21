'use client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

export function LoginModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (user: User) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isLogin) {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) {
          toast.error(error.message)
          return
        }

        toast.success('Successfully logged in')
        if (data.user && onSuccess) {
          onSuccess(data.user)
        }
      } else {
        if (password !== confirmPassword) {
          toast.error('Passwords do not match')
          setIsLoading(false)
          return
        }

        const { error } = await supabase.auth.signUp({
          email,
          password
        })

        if (error) {
          toast.error(error.message)
          return
        }

        toast.success(
          'Registration successful. Please check your email for verification'
        )
      }

      router.refresh()
      onClose()
    } catch (error) {
      toast.error(
        isLogin
          ? 'Login failed. Please try again'
          : 'Registration failed. Please try again'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </DialogTitle>
          <DialogDescription>
            {isLogin
              ? 'Enter your email and password to login'
              : 'Fill in the information below to create your account'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={isLoading}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
              className="h-11"
            />
          </div>
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={isLoading}
                className="h-11"
              />
            </div>
          )}
          <div className="flex flex-col space-y-4 pt-4">
            {!isLogin && (
              <p className="text-sm text-center text-gray-600">
                By creating an account, you agree to our{' '}
                <a href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </p>
            )}
            <Button type="submit" disabled={isLoading} className="h-11">
              {isLoading
                ? isLogin
                  ? 'Logging in...'
                  : 'Creating account...'
                : isLogin
                ? 'Log in'
                : 'Create account'}
            </Button>
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={toggleMode}
                disabled={isLoading}
                className="text-sm"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Log in'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
