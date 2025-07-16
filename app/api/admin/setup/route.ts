import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { email, action } = await req.json()
    
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 })
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
    const isCurrentUserAdmin = session.user.email === adminEmail

    // Only allow admin operations if current user is admin or this is the first admin setup
    if (!isCurrentUserAdmin && email !== adminEmail) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'promote') {
      return Response.json({
        success: true,
        message: 'Admin access is controlled by the ADMIN_EMAIL environment variable',
        instructions: [
          '1. Set the ADMIN_EMAIL environment variable to the desired admin email',
          '2. Sign up or log in with that email address',
          '3. The user will automatically have admin access',
          '4. Restart the application if you changed the environment variable'
        ]
      })
    }

    return Response.json({
      success: true,
      message: 'Admin operations are managed through environment variables'
    })

  } catch (error) {
    console.error('Admin setup error:', error)
    return Response.json(
      { success: false, error: 'Failed to process admin setup' },
      { status: 500 }
    )
  }
}
