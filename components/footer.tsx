import Link from "next/link";
import { SiDiscord, SiGithub, SiTwitter } from "react-icons/si";
import { Button } from "@/components/ui/button";

export const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-0 right-0 w-fit p-1 md:p-2">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground/50"
        >
          <Link href="https://discord.gg/zRxaseCuGq" target="_blank">
            <SiDiscord size={18} />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground/50"
        >
          <Link href="https://twitter.com/morphic_ai" target="_blank">
            <SiTwitter size={18} />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground/50"
        >
          <Link href="https://git.new/morphic" target="_blank">
            <SiGithub size={18} />
          </Link>
        </Button>
      </div>
    </footer>
  );
};
