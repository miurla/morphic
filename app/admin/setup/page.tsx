'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { AlertCircle, CheckCircle, Key, Mail, Shield, User } from 'lucide-react'
import { useEffect, useState } from 'react'

// Simple Alert component
function Alert({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-4 border rounded-md ${className}`}>
      {children}
    </div>
  )
}

function AlertDescription({ children }: { children: React.ReactNode }) {
  return <div className="text-sm">{children}</div>
}

export default function AdminSetup() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  
  const supabase = createClientComponentClient()

  useEffect(() => {
    checkCurrentUser()
    setAdminEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@example.com')
  }, [])

  const checkCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('Error getting user:', error)
    }
  }

  const isCurrentUserAdmin = () => {
    if (!currentUser) return false
    
    return currentUser.user_metadata?.role === 'admin' || 
           currentUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
           currentUser.user_metadata?.admin === true
  }

  const promoteToAdmin = async () => {
    if (!currentUser) {
      setMessage('You must be logged in to promote yourself to admin')
      setMessageType('error')
      return
    }

    setIsLoading(true)
    try {
      // Update user metadata to include admin role
      const { error } = await supabase.auth.updateUser({
        data: { 
          role: 'admin',
          admin: true 
        }
      })

      if (error) throw error

      setMessage('Successfully promoted to admin! Please refresh the page.')
      setMessageType('success')
      
      // Refresh user data
      await checkCurrentUser()
    } catch (error) {
      console.error('Error promoting to admin:', error)
      setMessage('Failed to promote to admin. Please try again.')
      setMessageType('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Admin Setup</h1>
          <p className="text-muted-foreground">
            Set up your admin access for the Educational Platform
          </p>
        </div>

        {/* Current User Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Current User Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email:</span>
                  <span className="text-sm">{currentUser.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Admin Status:</span>
                  {isCurrentUserAdmin() ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Regular User
                    </Badge>
                  )}
                </div>
                {isCurrentUserAdmin() && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      You have admin access! You can now access the admin dashboard.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No user logged in</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Admin Email Configuration</span>
            </CardTitle>
            <CardDescription>
              The email address configured as admin in environment variables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Admin Email:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {adminEmail}
                </code>
              </div>
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  If you sign up with this email address, you'll automatically get admin access.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Admin Actions</span>
            </CardTitle>
            <CardDescription>
              Ways to get admin access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!currentUser ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You need to sign up or log in first. Go to the{' '}
                  <a href="/auth/login" className="underline text-blue-600">
                    login page
                  </a>{' '}
                  to get started.
                </AlertDescription>
              </Alert>
            ) : !isCurrentUserAdmin() ? (
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You can promote yourself to admin if you're the platform owner.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={promoteToAdmin}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Promoting...' : 'Promote Current User to Admin'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    You're already an admin! You can access the admin dashboard.
                  </AlertDescription>
                </Alert>
                <div className="flex space-x-2">
                  <a href="/admin" className="flex-1">
                    <Button className="w-full">
                      Go to Admin Dashboard
                    </Button>
                  </a>
                  <a href="/admin/lessons/create" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Create Lesson
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {message && (
              <Alert className={messageType === 'error' ? 'border-red-200 bg-red-50' : 
                              messageType === 'success' ? 'border-green-200 bg-green-50' : ''}>
                {messageType === 'error' ? <AlertCircle className="h-4 w-4" /> : 
                 messageType === 'success' ? <CheckCircle className="h-4 w-4" /> : null}
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <p><strong>Option 1: Use Admin Email</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Update <code>ADMIN_EMAIL</code> in your <code>.env.local</code> file</li>
                <li>Sign up with that email address</li>
                <li>You'll automatically get admin access</li>
              </ol>
              
              <p className="pt-2"><strong>Option 2: Promote Current User</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Sign up with any email address</li>
                <li>Use the "Promote Current User to Admin" button above</li>
                <li>Your user metadata will be updated with admin rights</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
