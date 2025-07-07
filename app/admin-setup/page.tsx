'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Shield, UserCheck, Mail, Key, CheckCircle, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminSetup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      setEmail(user.email || '')
      
      // Check if user is already admin
      const adminEmail = 'admin@example.com' // process.env.NEXT_PUBLIC_ADMIN_EMAIL is not available on client
      const isUserAdmin = user.email === adminEmail || 
                         user.user_metadata?.role === 'admin' || 
                         user.user_metadata?.admin === true
      setIsAdmin(isUserAdmin)
    }
  }

  const handleSignUp = async () => {
    if (!email || !password) {
      setMessage('Please enter both email and password')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'admin',
            admin: true
          }
        }
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else if (data.user) {
        setMessage('Admin user created successfully! Please check your email to verify your account.')
        setUser(data.user)
        setIsAdmin(true)
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async () => {
    if (!email || !password) {
      setMessage('Please enter both email and password')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else if (data.user) {
        setMessage('Signed in successfully!')
        setUser(data.user)
        
        // Check admin status
        const adminEmail = 'admin@example.com'
        const isUserAdmin = data.user.email === adminEmail || 
                           data.user.user_metadata?.role === 'admin' || 
                           data.user.user_metadata?.admin === true
        setIsAdmin(isUserAdmin)
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePromoteToAdmin = async () => {
    if (!user) return

    setIsLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          role: 'admin',
          admin: true
        }
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('User promoted to admin successfully!')
        setIsAdmin(true)
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const goToAdmin = () => {
    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Setup</h1>
          <p className="text-gray-600">Set up your admin account for the educational platform</p>
        </div>

        {/* Admin Status */}
        {user && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserCheck className="h-5 w-5" />
                <span>Current User</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Email:</span>
                <span className="text-sm font-medium">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Admin Status:</span>
                {isAdmin ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Regular User
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>
              {user ? (isAdmin ? 'Admin Panel' : 'Promote to Admin') : 'Create Admin Account'}
            </CardTitle>
            <CardDescription>
              {user 
                ? (isAdmin 
                  ? 'You have admin access. Access the admin panel to manage lessons.'
                  : 'Promote your account to admin status to access lesson management.')
                : 'Create your admin account to start creating and managing lessons.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="admin@yourdomain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="password"
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={handleSignUp} 
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Creating...' : 'Create Admin'}
                  </Button>
                  <Button 
                    onClick={handleSignIn} 
                    variant="outline"
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </div>
              </>
            )}

            {user && !isAdmin && (
              <Button 
                onClick={handlePromoteToAdmin} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Promoting...' : 'Promote to Admin'}
              </Button>
            )}

            {user && isAdmin && (
              <Button 
                onClick={goToAdmin} 
                className="w-full"
              >
                Access Admin Panel
              </Button>
            )}

            {message && (
              <div className={`p-3 rounded-md text-sm ${
                message.includes('Error') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Environment Configuration</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-600 space-y-2">
            <p>Current admin email in environment: <code className="bg-gray-100 px-1 rounded">admin@example.com</code></p>
            <p>To set a different admin email, update <code>ADMIN_EMAIL</code> in your <code>.env.local</code> file.</p>
            <p>Users with the admin email or admin metadata will have automatic admin access.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
          
          {/* Step 1: Update Environment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                  1
                </div>
                <span>Update Environment Variable</span>
                {step > 1 && <CheckCircle className="h-5 w-5 text-green-600" />}
              </CardTitle>
              <CardDescription>
                Set your email as the admin email in the environment configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted p-3 rounded-md font-mono text-sm">
                ADMIN_EMAIL=your-email@example.com
              </div>
              <p className="text-sm text-muted-foreground">
                Edit the <code>.env.local</code> file and set <code>ADMIN_EMAIL</code> to your email address.
              </p>
              <Button 
                onClick={() => setStep(2)} 
                className="w-full"
                disabled={step > 1}
              >
                {step > 1 ? 'Completed' : 'I\'ve Updated the Environment Variable'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Sign Up */}
          <Card className={step < 2 ? 'opacity-50' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-sm ${
                  step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  2
                </div>
                <span>Create Your Account</span>
                {step > 2 && <CheckCircle className="h-5 w-5 text-green-600" />}
              </CardTitle>
              <CardDescription>
                Sign up with the admin email to get automatic admin access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    When you sign up with the admin email, you'll automatically get admin privileges.
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Link href="/auth/sign-up" className="flex-1">
                  <Button className="w-full" disabled={step < 2}>
                    <User className="mr-2 h-4 w-4" />
                    Go to Sign Up
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  onClick={() => setStep(3)}
                  disabled={step < 2}
                >
                  I've Signed Up
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Access Admin Panel */}
          <Card className={step < 3 ? 'opacity-50' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-sm ${
                  step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  3
                </div>
                <span>Access Admin Panel</span>
                <CheckCircle className="h-5 w-5 text-green-600" />
              </CardTitle>
              <CardDescription>
                You can now access the admin panel and start creating lessons
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800">
                    Once logged in with your admin account, you'll have full access to lesson creation and management.
                  </p>
                </div>
              </div>
              
              <Link href="/admin">
                <Button className="w-full" disabled={step < 3}>
                  <Settings className="mr-2 h-4 w-4" />
                  Go to Admin Dashboard
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Alternative Method */}
        <Card>
          <CardHeader>
            <CardTitle>Alternative: Manual User Promotion</CardTitle>
            <CardDescription>
              If you already have a user account, you can promote it to admin manually
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              To manually promote an existing user to admin:
            </p>
            <ol className="text-sm space-y-1 ml-4 list-decimal">
              <li>Go to your Supabase dashboard</li>
              <li>Navigate to Authentication → Users</li>
              <li>Find your user and click to edit</li>
              <li>In "User Metadata", add: <code>{`{"role": "admin"}`}</code></li>
              <li>Save the changes</li>
            </ol>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Once you have admin access, you can:
            </p>
            <ul className="text-sm space-y-1 ml-4 list-disc">
              <li>Create interactive lessons with AI assistance</li>
              <li>Generate TTS audio for lesson narration</li>
              <li>Manage and publish educational content</li>
              <li>Monitor student progress and engagement</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
