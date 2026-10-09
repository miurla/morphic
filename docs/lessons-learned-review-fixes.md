# Lessons Learned: Review-Fix Discipline

Written after the Better Auth provider PR (#1063), where roughly half of the
~30 automated review comments were **regressions introduced by the fixes for
earlier review comments** — not defects in the original branch. This document
records why that happened and the checklist that prevents it. Read it before
starting a round of review fixes.

## What happened

Two fix chains each spawned three or more follow-up review comments:

- **Destination threading.** Opening `/search` to logged-out users (fix A)
  made private-chat links 404 (fix A's regression). Redirecting to login with
  `?next=` lost the destination after sign-in; threading `next` through the
  OAuth `redirectTo` **broke Google sign-in entirely on Supabase deployments**
  (the redirect allowlist matches the callback URL exactly) and a hand-rolled
  validator for it contained a backslash open-redirect. Moving the destination
  to a cookie then cost a stale-cookie-hijack comment and a cross-tab race
  comment. Six comments deep from one small fix.
- **Invitation expiry clock.** Adding a client-side clock re-evaluation to fix
  a stale display spawned three more comments (fast browser clock, hydration
  delay, sub-minute drift) — one design gap, paid for three times, because the
  clock sources were never enumerated up front.

Other notable misses: a `NEXT_PUBLIC_*` gate added to client code even though
the repo ships a **prebuilt Docker image** where those values are frozen at
build time (the login page's `force-dynamic` comment exists for exactly this
reason); the share opt-in flag ignored even though the flag name had been
grepped mid-fix and the mismatch with the docs was literally in hand.

## Root causes

1. **Fix-local thinking.** Each comment was treated as a line-level patch
   instead of a change to a user journey. None of the regressions needed deep
   insight — each needed "walk every flow this edit touches."
2. **Cross-provider blindness.** This repo's auth plumbing is shared between
   Supabase and Better Auth. Fixes were reasoned about in the provider being
   tested, without re-deriving the other provider's constraints (e.g.
   Supabase's exact-match redirect allowlist).
3. **Security primitives written from intuition.** The open-redirect validator
   used the naive `startsWith('/') && !startsWith('//')` pattern whose bypasses
   are well documented. Use URL parsing (see `lib/auth/redirect-target.ts`).
4. **Distribution model ignored.** Prebuilt images freeze `NEXT_PUBLIC_*`
   values into client bundles at build time. Anything runtime-configurable
   must be evaluated server-side (e.g. folded into capabilities in
   `app/layout.tsx`) — never read from client code. The same applies to the
   deployment _profile_: the primary Morphic deployment is a single-user
   instance, and a guard added for multi-admin scenarios must be checked
   against the single-user shape first — the last-admin guard initially
   made the sole account unable to delete itself, contradicting the
   documented re-bootstrap flow.
5. **Test layers are journey-blind.** Unit tests mock at exactly the seams
   where these bugs lived (redirectTo shape, cookie lifecycle, middleware
   redirects). The Docker integration harness only caught journey bugs after
   checks were added to it — reactively, after each bot round, instead of in
   the same commit as the fix.

## Fix-round checklist

Before committing any review fix:

- [ ] **Walk the journeys.** List every user flow that touches the changed
      code path, crossed with each auth mode (anonymous, Supabase,
      Better Auth) and each session state (logged in, logged out, in-flight
      OAuth). Walk each one mentally, end to end. If the change touches a
      redirect URL, follow the redirect chain through every consumer of it.
- [ ] **Both providers.** If the edit is in shared plumbing (`proxy.ts`,
      provider interface, login forms, redirect helpers), re-check the _other_
      provider's constraints before shipping. Two minutes of docs beats a
      🔴 review comment.
- [ ] **Research before changing external-facing URL shapes.** OAuth
      redirect/callback URLs have provider-side constraints (allowlists,
      exact matches, registered origins). Verify them, don't assume.
- [ ] **Use established safe patterns for security primitives.** Open
      redirects: parse with `URL` and reject anything that resolves off-origin.
      Never hand-roll prefix checks.
- [ ] **Runtime-configurable flags are server-side.** In this repo, a
      `NEXT_PUBLIC_*` flag read in client code is a build-time constant.
      Evaluate it in a server component and pass it down (capabilities,
      props, context).
- [ ] **Add the journey test in the same commit.** If the fix changes a
      user-visible flow, extend the integration harness (or a test) in the
      same commit — proactively, not after the next review round finds it.
- [ ] **Enumerate the failure/clock/race model once.** When a fix introduces
      time, retries, or concurrency, write down every source of skew/delay/
      race that can hit it and handle them in one pass instead of one comment
      at a time.
- [ ] **Mirror test:** ask what the fix _newly enables_ (a stale cookie, a
      re-enabled link, a hidden button) and check that state too.
- [ ] **Trace callers of a function you guard.** A guard inside a callee
      runs _after_ the caller's side effects. This PR's last-admin deletion
      guard was added inside `deleteUser`, but the caller had already
      deleted chats, notes, and files by then — a rejected deletion still
      destroyed the account's data. Destructive flows need the check at a
      pre-check hook (see `canDeleteUser` / `validateDeleteUserConfig`)
      before the first destructive step.
- [ ] **Never leave an identified race "acceptable" in silence.** The same
      guard counted admins without a lock; two concurrent admin deletions
      could both pass the count. If the consequence is loss of control,
      serialize it (transaction + `SELECT ... FOR UPDATE`); at minimum,
      document the accepted race where the reader will see it.
- [ ] **A fast pre-check and the authoritative check can diverge.** The
      unlocked `canDeleteUser` pre-check and the locked check inside
      `deleteUser` can disagree under concurrency; the destructive steps
      must be ordered after the *authoritative* check, not merely after
      the pre-check.
- [ ] **Concatenating user input into a URL is a security primitive.**
      `new URL('/' + userInput, base)` escapes the origin when a decoded
      segment starts with a slash (an encoded `%2f` turns the path
      protocol-relative). Always assert the resolved `host` matches the
      expected allowlist after construction.

## The meta-lesson

Automated reviewers review the **diff**, not the **journey** — and so did I,
with "does this resolve the flagged comment?" eyes while the bots had fresh
eyes on every fix. Every fix is a change with its own blast radius; give it the
same rigor as the original feature.
