import HistoryContainer from './history-container'

export async function Sidebar() {
  return (
    <div className="h-screen p-2 fixed top-0 right-0 flex-col justify-center pb-24 hidden lg:flex">
      <HistoryContainer />
    </div>
  )
}
