import { Marquee } from '@/components/ui/marquee'

const TESTIMONIALS = [
  {
    name: 'Sophie M.',
    handle: '@sophie_rh',
    source: 'linkedin',
    text: "Melron m'a permis de trouver 3 opportunités en une semaine que je n'aurais jamais vues autrement. L'IA comprend vraiment mon profil."
  },
  {
    name: 'Thomas B.',
    handle: '@tb_growth',
    source: 'linkedin',
    text: "La prospection LinkedIn n'a jamais été aussi simple. Je génère des messages personnalisés en 10 secondes. Impressionnant."
  },
  {
    name: 'Aisha K.',
    handle: '@aisha_dev',
    source: 'linkedin',
    text: "WOW. J'ai décroché un entretien chez une licorne grâce à Melron. Le smart message est un game changer absolu."
  },
  {
    name: 'Marc D.',
    handle: '@marcd_biz',
    source: 'linkedin',
    text: 'Enfin un outil qui comprend le networking LinkedIn. Les alertes WhatsApp sont parfaites, je ne rate plus rien.'
  },
  {
    name: 'Julie F.',
    handle: '@julie_rdc',
    source: 'linkedin',
    text: "J'étais sceptique mais la première semaine j'ai eu 5 réponses positives sur mes messages d'approche. Incroyable."
  },
  {
    name: 'Kevin L.',
    handle: '@kevinl_vc',
    source: 'linkedin',
    text: 'Pour la levée de fonds, Melron identifie exactement les bons VCs dans mon réseau. Un outil indispensable.'
  },
  {
    name: 'Clara N.',
    handle: '@clarandev',
    source: 'linkedin',
    text: "Le schedule message m'a changé la vie. Je programme tout le dimanche soir et la semaine tourne toute seule."
  },
  {
    name: 'Riad H.',
    handle: '@riadh_sales',
    source: 'linkedin',
    text: "Notre équipe sales a multiplié par 3 son taux de réponse sur LinkedIn depuis qu'on utilise Melron."
  },
  {
    name: 'Emma T.',
    handle: '@emmat_talent',
    source: 'linkedin',
    text: "En tant que recruteuse, je trouve des profils qualifiés 5x plus vite. La recherche d'opportunités est précise."
  },
  {
    name: 'Alex P.',
    handle: '@alexp_cto',
    source: 'linkedin',
    text: "J'utilise Melron pour sourcer des ingénieurs. La qualité des profils trouvés est vraiment au-dessus de tout."
  },
  {
    name: 'Fatou D.',
    handle: '@fatoud_mkt',
    source: 'linkedin',
    text: "La communauté Melron est top. J'ai trouvé un cofondateur via les prompts partagés. Ça va bien au-delà d'un simple outil."
  },
  {
    name: 'Yann C.',
    handle: '@yannc_cfo',
    source: 'linkedin',
    text: "Melron analyse mon réseau et me dit exactement qui contacter pour chaque deal. C'est comme avoir un assistant dédié."
  }
]

function SourceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current text-blue-600">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function TestimonialCard({
  name,
  handle,
  text
}: (typeof TESTIMONIALS)[number]) {
  return (
    <div className="mb-4 w-[300px] rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/50 text-sm font-bold text-foreground">
            {name[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {name}
            </p>
            <p className="text-xs text-muted-foreground">{handle}</p>
          </div>
        </div>
        <SourceIcon />
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed">{text}</p>
    </div>
  )
}

const col1 = TESTIMONIALS.slice(0, 3)
const col2 = TESTIMONIALS.slice(3, 6)
const col3 = TESTIMONIALS.slice(6, 9)
const col4 = TESTIMONIALS.slice(9, 12)

export function TestimonialsSection() {
  return (
    <section className="w-full overflow-hidden px-6 pt-16 pb-24 md:px-12">
      <div className="text-center mb-5">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Our Community Loves Us
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          What people are saying
        </p>
      </div>

      <div
        className="relative mx-auto mt-8 flex h-[700px] max-w-7xl justify-center gap-4 overflow-hidden rounded-[2rem]"
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)'
        }}
      >
        <Marquee
          vertical
          pauseOnHover
          duration={25}
          className="h-full w-[300px]"
        >
          {col1.map(t => (
            <TestimonialCard key={t.handle} {...t} />
          ))}
        </Marquee>

        <Marquee
          vertical
          reverse
          pauseOnHover
          duration={30}
          className="hidden h-full w-[300px] sm:flex"
        >
          {col2.map(t => (
            <TestimonialCard key={t.handle} {...t} />
          ))}
        </Marquee>

        <Marquee
          vertical
          pauseOnHover
          duration={20}
          className="hidden h-full w-[300px] lg:flex"
        >
          {col3.map(t => (
            <TestimonialCard key={t.handle} {...t} />
          ))}
        </Marquee>

        <Marquee
          vertical
          reverse
          pauseOnHover
          duration={24}
          className="hidden h-full w-[300px] xl:flex"
        >
          {col4.map(t => (
            <TestimonialCard key={t.handle} {...t} />
          ))}
        </Marquee>
      </div>
    </section>
  )
}
