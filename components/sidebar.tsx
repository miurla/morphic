import HistoryContainer from "./history-container";

export async function Sidebar() {
  return (
    <div className="fixed right-0 top-0 hidden h-screen flex-col justify-center p-2 pb-24 sm:flex">
      <HistoryContainer location="sidebar" />
    </div>
  );
}
