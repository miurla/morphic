import { History } from "./history";
import { HistoryList } from "./history-list";

interface HistoryContainerProps {
  location: "sidebar" | "header";
}

export const HistoryContainer: React.FC<HistoryContainerProps> = async ({
  location,
}) => {
  return (
    <div
      className={location === "header" ? "block sm:hidden" : "hidden sm:block"}
    >
      <History location={location}>
        <HistoryList userId="anonymous" />
      </History>
    </div>
  );
};
