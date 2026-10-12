# Lessons Learned: Review-Fix Discipline

A checklist for rounds of review fixes, born from one auth PR where roughly
half of ~30 automated review comments were regressions introduced by the
fixes for earlier comments — not defects in the original branch. Read it
before starting a round of review fixes.

## Why fixes beget fixes

A fix treated as a line-level patch instead of a change to a user journey
spawns regressions. The recurring root causes:

1. **Fix-local thinking.** The change was reasoned about at the edited line,
   not across every flow that consumes it (redirect chains, cookies,
   feature flags).
2. **Cross-provider blindness.** Auth plumbing is shared between Supabase
   and Better Auth, and fixes were reasoned about only for the provider
   being tested. Each provider carries external constraints (e.g.
   Supabase's exact-match redirect allowlist).
3. **Security primitives written from intuition.** Hand-rolled prefix
   checks for open redirects or URL joins have well-documented bypasses.
4. **Distribution model ignored.** Prebuilt Docker images freeze
   `NEXT_PUBLIC_*` values at build time, and the primary deployment is a
   single-user instance — guards designed for multi-admin setups must be
   checked against the single-user shape first.
5. **Test layers journey-blind.** Unit tests mock at exactly the seams
   where the regressions lived (redirect shapes, cookie lifecycle,
   middleware redirects); the Docker integration harness only caught
   journey bugs after checks were added to it.

## Fix-round checklist

Before committing any review fix:

- [ ] **Walk the journeys.** List every user flow that touches the changed
      code path, crossed with each auth mode (anonymous, Supabase,
      Better Auth) and each session state (logged in, logged out,
      in-flight OAuth). If the change touches a redirect URL, follow the
      chain through every consumer of it.
- [ ] **Both providers.** For shared plumbing (`proxy.ts`, the provider
      interface, login forms, redirect helpers), re-check the _other_
      provider's constraints before shipping.
- [ ] **Research external-facing URL shapes before changing them.** OAuth
      redirect/callback URLs have provider-side constraints (allowlists,
      exact matches, registered origins). Verify, don't assume.
- [ ] **Use established safe patterns for security primitives.** Open
      redirects: parse with `URL` and reject anything that resolves
      off-origin (see `lib/auth/redirect-target.ts`). Never hand-roll
      prefix checks.
- [ ] **Concatenating user input into a URL is a security primitive too.**
      `new URL('/' + userInput, base)` escapes the origin when a decoded
      segment starts with a slash (an encoded `%2f` turns the path
      protocol-relative). Assert the resolved `host` matches the expected
      allowlist after construction.
- [ ] **Runtime-configurable flags are server-side.** `NEXT_PUBLIC_*`
      reads are inlined at build time even in server bundles, so they are
      frozen in prebuilt images. Evaluate the flag server-side (e.g. fold
      it into capabilities in `app/layout.tsx`) and pass it down; prefer
      a non-public env var for anything that must be flippable at runtime.
- [ ] **Add the journey test in the same commit.** If the fix changes a
      user-visible flow, extend the integration harness (or a test) in
      the same commit — not after the next review round finds it.
- [ ] **Enumerate the failure/clock/race model once.** When a fix
      introduces time, retries, or concurrency, write down every source
      of skew/delay/race that can hit it and handle them in one pass.
- [ ] **Mirror test:** ask what the fix _newly enables_ (a stale cookie,
      a re-enabled link, a hidden button) and check that state too.
- [ ] **Trace callers of a function you guard.** A guard inside a callee
      runs _after_ the caller's side effects — a deletion guard inside
      `deleteUser` cannot protect data the caller already deleted. In
      destructive flows the check must run before the first destructive
      step.
- [ ] **A fast pre-check and the authoritative check can diverge.** Under
      concurrency an unlocked pre-check and a locked authoritative check
      can disagree; order destructive steps after the _authoritative_
      check, not merely after the pre-check.
- [ ] **Never leave an identified race "acceptable" in silence.** If a
      check must not be passed twice, serialize it (transaction +
      `SELECT ... FOR UPDATE`); at minimum, document the accepted race
      where the reader will see it.
- [ ] **An insert can always commit just after your count — re-check
      after commit.** Row locks serialize updates to existing rows but
      not new inserts. When the invariant is "at least one X exists",
      re-run the deterministic election after the deleting transaction
      commits: the racing writer's own after-commit hook and the
      re-election cannot both miss each other without a timestamp cycle.

## The meta-lesson

Automated reviewers review the **diff**, not the **journey** — and so does
a fixer with "does this resolve the flagged comment?" eyes. Every fix is a
change with its own blast radius; give it the same rigor as the original
feature.
