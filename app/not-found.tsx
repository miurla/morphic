import { nanoid } from 'ai'
import { AI } from './actions'

export const runtime = 'edge'

export default function Page() {
  const id = nanoid()
  return (
    <AI initialAIState={{ chatId: id, messages: [] }}>
      <h2></h2>
    </AI>
  )
}
