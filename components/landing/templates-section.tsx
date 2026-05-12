import Link from 'next/link'

import { ArrowRight, Heart, Users } from 'lucide-react'

import promptsData from '@/lib/community/prompts-data.json'

type Prompt = (typeof promptsData)[number]

const templates = promptsData.slice(0, 8) as Prompt[]

const COVER_BACKGROUNDS = [
  'radial-gradient(circle at 68% 24%, #ffcf6b 0 18%, transparent 33%), radial-gradient(circle at 25% 62%, #155f84 0 18%, transparent 34%), linear-gradient(135deg, #8fb8f1, #f38abf 78%)',
  'radial-gradient(circle at 72% 28%, #8df6c8 0 16%, transparent 34%), radial-gradient(circle at 30% 70%, #283c86 0 18%, transparent 35%), linear-gradient(135deg, #f2d184, #dc79cf 74%)',
  'radial-gradient(circle at 65% 28%, #ff8e72 0 17%, transparent 35%), radial-gradient(circle at 28% 64%, #23b7a7 0 18%, transparent 36%), linear-gradient(135deg, #7da8ff, #f6a3d1)',
  'radial-gradient(circle at 72% 30%, #ffe66d 0 16%, transparent 35%), radial-gradient(circle at 27% 66%, #7137c8 0 18%, transparent 34%), linear-gradient(135deg, #7fe0de, #ffa0b8)',
  'radial-gradient(circle at 70% 25%, #fb7185 0 18%, transparent 34%), radial-gradient(circle at 26% 70%, #2563eb 0 18%, transparent 34%), linear-gradient(135deg, #a7f3d0, #f9a8d4)',
  'radial-gradient(circle at 68% 26%, #f97316 0 17%, transparent 35%), radial-gradient(circle at 28% 66%, #0f766e 0 18%, transparent 36%), linear-gradient(135deg, #93c5fd, #f0abfc)',
  'radial-gradient(circle at 72% 26%, #bef264 0 17%, transparent 35%), radial-gradient(circle at 30% 68%, #7c3aed 0 18%, transparent 35%), linear-gradient(135deg, #67e8f9, #fda4af)',
  'radial-gradient(circle at 70% 24%, #fde047 0 17%, transparent 35%), radial-gradient(circle at 28% 66%, #1d4ed8 0 18%, transparent 35%), linear-gradient(135deg, #c4b5fd, #fb7185)'
]

const TEMPLATE_STATS = [
  { uses: '12.4k', likes: '2.1k' },
  { uses: '9.8k', likes: '1.7k' },
  { uses: '8.2k', likes: '1.4k' },
  { uses: '7.6k', likes: '1.2k' },
  { uses: '6.9k', likes: '984' },
  { uses: '6.1k', likes: '812' },
  { uses: '5.7k', likes: '746' },
  { uses: '5.2k', likes: '690' }
]

const AVATAR_IMAGE_IDS = [
  [11, 32, 47],
  [5, 25, 44],
  [12, 36, 52],
  [8, 30, 56],
  [14, 40, 60],
  [18, 42, 62],
  [20, 48, 65],
  [22, 50, 68]
]

export function TemplatesSection() {
  return (
    <section className="w-full px-6 pt-16 pb-12 md:px-12 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Start From a Template
          </h2>
          <p className="mt-2 text-muted-foreground">
            Kick start your next action from a production-ready template
          </p>
        </div>
        <Link
          href="/community"
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {templates.map((template, index) => {
          const stats = TEMPLATE_STATS[index]
          const avatarIds = AVATAR_IMAGE_IDS[index]

          return (
            <Link
              key={template.id}
              href="/auth/login"
              className="group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className="h-48 overflow-hidden"
                style={{ backgroundImage: COVER_BACKGROUNDS[index] }}
              />

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold leading-tight text-foreground line-clamp-2 group-hover:underline">
                  {template.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground line-clamp-2">
                  {template.expectedOutput}
                </p>

                <div className="mt-6 flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {avatarIds.map(id => (
                      <div
                        key={id}
                        className="size-9 rounded-full border-2 border-white object-cover"
                        style={{
                          backgroundImage: `url(https://i.pravatar.cc/80?img=${id})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                    ))}
                    <div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-muted text-xs font-bold text-foreground">
                      +{index + 3}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {stats.uses}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3.5" />
                      {stats.likes}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
