import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface SyncButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  className?: string;
}

export function SyncButton({
  onClick,
  isLoading,
  icon,
  children,
  variant = "outline",
  size = "sm",
  disabled,
  className,
}: SyncButtonProps) {
  return (
    <Button
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={isLoading || disabled}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
      ) : icon ? (
        <span className="mr-2">{icon}</span>
      ) : null}
      {children}
    </Button>
  );
}
