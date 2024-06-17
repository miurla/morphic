import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ToolBadgeProps {
  tool: string;
  children: React.ReactNode;
  className?: string;
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  tool,
  children,
  className,
}) => {
  const icon: Record<string, React.ReactNode> = {
    search: <Search size={14} />,
  };

  return (
    <Badge className={className} variant="secondary">
      {icon[tool]}
      <span className="ml-1">{children}</span>
    </Badge>
  );
};
