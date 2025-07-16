import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/db/prisma'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      role: string
    }
  }

  interface User {
    id: string
    email: string
    name?: string
    image?: string
    role: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // For now, we'll allow any email/password combination
        // In a real app, you'd validate against your user database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          // Create user if they don't exist (for demo purposes)
          const hashedPassword = await bcrypt.hash(credentials.password, 12)
          const newUser = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split('@')[0],
              // In a real app, you'd store the hashed password
              // For now, we'll just store basic user info
            }
          })
          return {
            id: newUser.id,
            email: newUser.email!,  // We know this is non-null since we just created it
            name: newUser.name || newUser.email!.split('@')[0],
            role: newUser.role
          }
        }

        // Only return if user has an email
        if (!user.email) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          role: user.role
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user && token?.sub) {
        session.user.id = token.sub
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
  },
}
