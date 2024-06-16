import { IconLogo } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import HistoryContainer from "./history-container";
import { ModeToggle } from "./mode-toggle";

export const Header: React.FC = async () => {
  return (
    <header className="fixed z-10 flex w-full items-center justify-between bg-background/80 p-1 backdrop-blur md:bg-transparent md:p-2 md:backdrop-blur-none">
      <div>
        <a href="/">
          <IconLogo className={cn("h-5 w-5")} />
          <span className="sr-only">Morphic</span>
        </a>
      </div>
      <div className="flex gap-0.5">
        <ModeToggle />
        <HistoryContainer location="header" />
      </div>
    </header>
  );
};

export default Header;
