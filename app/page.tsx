import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'

import { ArtifactProvider } from '@/components/artifact/artifact-context'
import { Chat } from '@/components/chat'
import { LandingFooter, LandingNavbar } from '@/components/landing/landing-page'
import { landingLightTheme } from '@/components/landing/landing-theme'
import { TemplatesSection } from '@/components/landing/templates-section'
import { TestimonialsSection } from '@/components/landing/testimonials-section'

export default async function Page() {
  const userId = await getCurrentUserId()
  const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
  const modelSelectorData = await getModelSelectorData()

  if (!userId) {
    return (
      <div
        className="h-dvh w-full overflow-y-auto bg-white text-black"
        style={landingLightTheme}
      >
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-white">
          <div className="absolute inset-0 [background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="pointer-events-none absolute inset-0 bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
          <LandingNavbar />
          <div className="relative z-10 flex flex-1 items-center justify-center">
            <ArtifactProvider>
              <Chat
                isGuest
                isCloudDeployment={isCloudDeployment}
                modelSelectorData={modelSelectorData}
              />
            </ArtifactProvider>
          </div>
        </div>
        <div className="relative bg-white">
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[#03060d]" />
          <div
            className="relative z-10 overflow-hidden rounded-t-[4.5rem] rounded-b-[4.5rem] bg-[#f7f8fa] shadow-[0_18px_45px_rgba(0,0,0,0.22)]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(15, 23, 42, 0.08) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f7f8fa] to-[#f7f8fa]" />
            <div className="relative">
              <TemplatesSection />
              <TestimonialsSection />
            </div>
          </div>
        </div>
        <div className="bg-[#03060d]">
          <LandingFooter />
        </div>
      </div>
    )
  }

  return (
    <Chat
      isGuest={false}
      isCloudDeployment={isCloudDeployment}
      modelSelectorData={modelSelectorData}
    />
  )
}
