'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Github } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { IconBlinkingLogo } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'

type AuthMode = 'signin' | 'signup'

type AuthModalContextValue = {
  openAuthModal: (mode?: AuthMode) => void
  closeAuthModal: () => void
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null)

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function useAuthModal() {
  const context = useContext(AuthModalContext)

  if (!context) {
    throw new Error('useAuthModal must be used within AuthModalProvider')
  }

  return context
}

export function AuthModalProvider({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('signup')
  const [emailMode, setEmailMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const clearAuthQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (!params.has('auth')) return

    params.delete('auth')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const openAuthModal = useCallback((nextMode: AuthMode = 'signup') => {
    setMode(nextMode)
    setEmailMode(false)
    setError(null)
    setSuccess(null)
    setOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setOpen(false)
    clearAuthQuery()
  }, [clearAuthQuery])

  useEffect(() => {
    const authMode = searchParams.get('auth')

    if (authMode === 'signin' || authMode === 'signup') {
      openAuthModal(authMode)
    }
  }, [openAuthModal, searchParams])

  const contextValue = useMemo(
    () => ({ openAuthModal, closeAuthModal }),
    [openAuthModal, closeAuthModal]
  )

  const getNextUrl = () => {
    if (typeof window === 'undefined') return '/'

    const url = new URL(window.location.href)
    url.searchParams.delete('auth')
    return `${url.pathname}${url.search}`
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/oauth?next=${encodeURIComponent(getNextUrl())}`
        }
      })

      if (error) throw error
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'OAuth failed')
      setIsLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'signup' && password !== repeatPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const result =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/`
              }
            })

      if (result.error) throw result.error

      if (mode === 'signup' && !result.data.session) {
        setSuccess('Check your email to confirm your account.')
        return
      }

      closeAuthModal()
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthModalContext.Provider value={contextValue}>
      {children}
      <Dialog
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen)
          if (!nextOpen) clearAuthQuery()
        }}
      >
        <DialogContent className="max-w-[92vw] rounded-[1.75rem] border-0 bg-white p-9 text-black shadow-2xl sm:max-w-[430px]">
          <DialogHeader className="items-start space-y-5 text-left">
            <IconBlinkingLogo className="size-14" />
            <div>
              <DialogTitle className="text-3xl font-bold tracking-tight text-[#0f172a]">
                {mode === 'signup' ? 'Start networking.' : 'Welcome back.'}
              </DialogTitle>
              <DialogDescription className="mt-3 text-xl text-slate-500">
                {mode === 'signup'
                  ? 'Create a free account'
                  : 'Sign in to continue'}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {!emailMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 w-full gap-3 rounded-xl border-slate-200 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:text-slate-900"
                  disabled={isLoading}
                  onClick={() => handleOAuth('google')}
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 w-full gap-3 rounded-xl border-slate-200 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:text-slate-900"
                  disabled={isLoading}
                  onClick={() => handleOAuth('github')}
                >
                  <Github className="size-5 shrink-0" />
                  <span>Continue with GitHub</span>
                </Button>

                <div className="flex items-center gap-4 py-5 text-xs font-semibold uppercase text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  or
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <Button
                  type="button"
                  className="h-14 w-full rounded-xl bg-slate-950 text-base font-semibold text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800"
                  disabled={isLoading}
                  onClick={() => {
                    setEmailMode(true)
                    setError(null)
                    setSuccess(null)
                  }}
                >
                  Continue with email
                </Button>
              </>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-password">Password</Label>
                  <PasswordInput
                    id="auth-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="auth-repeat-password">
                      Repeat password
                    </Label>
                    <PasswordInput
                      id="auth-repeat-password"
                      required
                      value={repeatPassword}
                      onChange={e => setRepeatPassword(e.target.value)}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    disabled={isLoading}
                    onClick={() => setEmailMode(false)}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? 'Please wait...'
                      : mode === 'signup'
                        ? 'Sign up'
                        : 'Sign in'}
                  </Button>
                </div>
              </form>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            <button
              type="button"
              className="w-full pt-2 text-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup')
                setEmailMode(false)
                setError(null)
                setSuccess(null)
              }}
            >
              {mode === 'signup'
                ? 'Already have an account? Sign in'
                : 'Need an account? Sign up'}
            </button>

            <p
              className={cn(
                'px-2 pt-4 text-center text-xs leading-relaxed text-slate-400',
                emailMode && 'pt-2'
              )}
            >
              By continuing, you agree to the{' '}
              <Link href="#" className="underline underline-offset-2">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="#" className="underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AuthModalContext.Provider>
  )
}
