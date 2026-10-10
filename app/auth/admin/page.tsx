import { redirect } from 'next/navigation'

import { invitationView } from '@/lib/actions/admin-views'
import { listInvitations } from '@/lib/auth/better-auth/invitations'
import { listMembers } from '@/lib/auth/better-auth/members'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getAuthProvider } from '@/lib/auth/provider'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

import { InvitationsManager } from '@/components/admin/invitations-manager'
import { MemberRoleManager } from '@/components/admin/member-role-manager'
import { ResetMemberPasswordForm } from '@/components/admin/reset-member-password-form'

// The provider check below short-circuits at build time (the build has no
// better-auth configuration), which would bake the redirect('/') into a
// static route and make the admin page unreachable at runtime.
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const provider = getAuthProvider()
  if (provider.name !== 'better-auth') {
    redirect('/')
  }

  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    redirect('/')
  }

  const [invitations, members] = await Promise.all([
    listInvitations(),
    listMembers()
  ])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Instance administration</h1>
        <p className="text-sm text-muted-foreground">
          Manage invitations and member accounts for this Morphic instance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>
            Create invitation links for sign-up when the instance runs in invite
            mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationsManager invitations={invitations.map(invitationView)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Member roles</CardTitle>
          <CardDescription>
            Promote members to admin. The last remaining admin cannot delete
            their own account until another admin exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberRoleManager members={members} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset member password</CardTitle>
          <CardDescription>
            Set a new password for a member without email delivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetMemberPasswordForm members={members} />
        </CardContent>
      </Card>
    </div>
  )
}
