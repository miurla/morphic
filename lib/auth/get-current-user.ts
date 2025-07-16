import { prisma } from '@/lib/db/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'

export async function getCurrentUser() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

export async function getCurrentUserId() {
  const user = await getCurrentUser()
  return user?.id ?? 'anonymous'
}
