import { History } from './history'

export async function Sidebar() {
  return (
    <div className="h-screen p-2 fixed top-0 right-0 flex-col justify-center pb-24 hidden sm:flex">
      <History location="sidebar" />
    </div>
  )
}
