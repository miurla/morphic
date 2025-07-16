'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Mail, UserCheck, AlertCircle, CheckCircle, Copy } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { User } from 'next-auth'

export default function AdminSetup() {
  const { data: session, status } = useSession()
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const isUserAdmin = (user: User | null) => {
    if (!user) return false
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@example.com'
    return user.email === adminEmail
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage({ type: 'success', text: 'Copied to clipboard!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to copy to clipboard' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@example.com'
  const isCurrentUserAdmin = isUserAdmin(session?.user || null)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Setup
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure admin access for the platform
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-100 text-green-800' :
            message.type === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : 
             <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Current Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!session?.user ? (
              <div className="space-y-4">
                <Badge variant="secondary">Not Logged In</Badge>
                <p className="text-muted-foreground">
                  You need to be logged in to check your admin status.
                </p>
                <div className="flex space-x-2">
                  <Link href="/auth/signin">
                    <Button>Login</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Email:</span>
                  <code className="bg-muted px-2 py-1 rounded">{session.user.email}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span>Admin Status:</span>
                  <Badge className={isCurrentUserAdmin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {isCurrentUserAdmin ? 'Admin' : 'Not Admin'}
                  </Badge>
                </div>
                {isCurrentUserAdmin && (
                  <div className="mt-4">
                    <Link href="/admin">
                      <Button>
                        <Shield className="h-4 w-4 mr-2" />
                        Go to Admin Panel
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Configuration */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Admin Configuration
            </CardTitle>
            <CardDescription>
              Configure which email address has admin access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Current Admin Email (from environment):</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="bg-muted px-3 py-2 rounded flex-1">{adminEmail}</code>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(adminEmail)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">How to become an admin:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>
                  <strong>Option 1:</strong> Sign up with the email address: <code className="bg-blue-100 px-1 rounded">{adminEmail}</code>
                </li>
                <li>
                  <strong>Option 2:</strong> Update the <code className="bg-blue-100 px-1 rounded">ADMIN_EMAIL</code> environment variable to your email address
                </li>
                <li>
                  <strong>Option 3:</strong> Ask a current admin to promote your account
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* How to Update Environment */}
        <Card>
          <CardHeader>
            <CardTitle>Update Admin Email</CardTitle>
            <CardDescription>
              To change the admin email, update your environment configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Update .env.local file:</label>
              <div className="bg-muted p-3 rounded mt-1 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span>ADMIN_EMAIL=your-email@example.com</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard('ADMIN_EMAIL=your-email@example.com')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important Notes:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                <li>Restart the development server after updating environment variables</li>
                <li>Make sure to sign up with the exact email address specified</li>
                <li>Admin access is required to manage platform settings</li>
                <li>Only users with admin access can see the admin interface</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <Link href="/">
            <Button variant="outline">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
