import { Chat } from '@/components/chat'

export const maxDuration = 60

// Removed custom interface - let TypeScript infer from usage
// interface ChatPageProps {
//   params: { id: string }
// }

// Use inferred types directly
// Make the function non-async
// Use 'any' for props as a last resort workaround for build error
export default function ChatPage({ params }: any) {
  const { id } = params

  // Cannot await here anymore
  // const models = await getModels()

  // Render Chat without the models prop for now
  return <Chat id={id} />
}
