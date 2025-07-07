import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, action } = await req.json()
    
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Check if current user is already an admin (for security)
    const { data: currentUser } = await supabase.auth.getUser()
    const isCurrentUserAdmin = currentUser.user?.user_metadata?.role === 'admin' || 
                               currentUser.user?.email === process.env.ADMIN_EMAIL ||
                               currentUser.user?.user_metadata?.admin === true

    // Allow the first admin creation if no admin exists yet, or if current user is admin
    if (!isCurrentUserAdmin && process.env.ADMIN_EMAIL !== email) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'promote') {
      // This would require Supabase service role key to update user metadata
      // For now, we'll just return instructions
      return Response.json({
        success: true,
        message: 'To promote a user to admin, you need to update their user_metadata in Supabase dashboard',
        instructions: [
          '1. Go to your Supabase dashboard',
          '2. Navigate to Authentication > Users',
          '3. Find the user by email',
          '4. Click on the user to edit',
          '5. In the "User Metadata" section, add: {"role": "admin"}',
          '6. Save the changes'
        ]
      })
    }

    return Response.json({
      success: true,
      message: 'Admin operations require Supabase dashboard access for user metadata updates'
    })

  } catch (error) {
    console.error('Admin setup error:', error)
    return Response.json(
      { success: false, error: 'Failed to process admin setup' },
      { status: 500 }
    )
  }
}
