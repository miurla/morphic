import Link from 'next/link'

import {
  ArrowRight,
  Cable,
  Check,
  Code2,
  KeyRound,
  Play,
  Server
} from 'lucide-react'

import { LandingFooter, LandingNavbar } from '@/components/landing/landing-page'
import { landingLightTheme } from '@/components/landing/landing-theme'

const STEPS = [
  {
    title: 'Get your endpoint and token',
    description:
      'Create a Melron MCP token from your workspace. Keep the token private and use it only from trusted environments.',
    Icon: KeyRound
  },
  {
    title: 'Add environment variables',
    description:
      'Set MELRON_MCP_URL to your Streamable HTTP endpoint and MELRON_MCP_TOKEN to your token.',
    Icon: Code2
  },
  {
    title: 'Start your MCP-compatible client',
    description:
      'Melron connects through Streamable HTTP, so tools can be loaded dynamically by compatible assistants.',
    Icon: Server
  },
  {
    title: 'Use Melron tools in chat',
    description:
      'Run job search, people search, smart messages and network workflows from your assistant.',
    Icon: Play
  }
]

const ENV_LINES = [
  'MELRON_MCP_URL=https://your-melron-mcp-server.example.com/mcp',
  'MELRON_MCP_TOKEN=your_private_token'
]

const TOOL_EXAMPLES = [
  'smart_job_search',
  'smart_people_search',
  'smart_message',
  'smart_network_update'
]

export default function MelronMcpPage() {
  return (
    <div
      className="h-dvh w-full overflow-y-auto bg-white text-black"
      style={landingLightTheme}
    >
      <main className="relative bg-white">
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[#03060d]" />
        <div className="relative z-10 overflow-hidden rounded-b-[4.5rem] bg-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
          <div className="absolute inset-0 [background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="pointer-events-none absolute inset-0 bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_18%,black)]" />
          <LandingNavbar />

          <section className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 pt-36 pb-20 md:grid-cols-[0.95fr_1.05fr] md:px-12">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
                <Cable className="size-4 text-foreground" />
                Melron MCP
              </div>
              <h1 className="font-serif text-5xl font-semibold leading-none tracking-normal text-foreground md:text-7xl">
                Connect Melron to your MCP stack.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Expose Melron workflows to an MCP-compatible assistant through
                a Streamable HTTP server, then call network and outreach tools
                directly from chat.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Start from Melron
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/about-melron"
                  className="inline-flex items-center justify-center rounded-full border bg-white px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  What about Melron
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm md:p-7">
              <div className="rounded-2xl bg-[#03060d] p-5 text-white">
                <div className="flex items-center gap-2 text-sm text-white/55">
                  <span className="size-2 rounded-full bg-red-400" />
                  <span className="size-2 rounded-full bg-yellow-300" />
                  <span className="size-2 rounded-full bg-green-400" />
                  <span className="ml-2">.env.local</span>
                </div>
                <pre className="mt-5 overflow-x-auto text-sm leading-7 text-white/85">
                  {ENV_LINES.join('\n')}
                </pre>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {TOOL_EXAMPLES.map(tool => (
                  <div
                    key={tool}
                    className="flex min-w-0 items-center gap-2 rounded-xl border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground"
                  >
                    <Check className="size-4 shrink-0 text-foreground" />
                    <span className="truncate">{tool}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="relative z-10 mx-auto max-w-7xl px-6 pb-28 md:px-12">
            <div className="grid gap-4 md:grid-cols-4">
              {STEPS.map(({ title, description, Icon }, index) => (
                <div
                  key={title}
                  className="rounded-2xl border bg-white/85 p-5 shadow-sm backdrop-blur"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Icon className="size-7" />
                    <span className="text-sm font-bold text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <h2 className="mt-5 text-lg font-bold leading-tight">
                    {title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <div className="bg-[#03060d]">
        <LandingFooter />
      </div>
    </div>
  )
}
