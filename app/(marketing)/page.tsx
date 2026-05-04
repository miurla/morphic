import { FaqSection } from '@/components/marketing/faq-section'
import { FeaturesSection } from '@/components/marketing/features-section'
import { HeroSection } from '@/components/marketing/hero-section'
import { HowItWorksSection } from '@/components/marketing/how-it-works-section'
import { MarketingFooter } from '@/components/marketing/marketing-footer'
import { MarketingNav } from '@/components/marketing/marketing-nav'

export default function MarketingPage() {
  return (
    <>
      <MarketingNav />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <FaqSection />
      <MarketingFooter />
    </>
  )
}
