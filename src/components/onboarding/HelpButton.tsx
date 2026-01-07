import { useOnboarding } from '@/hooks/useOnboarding';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpButtonProps {
  className?: string;
  showLabel?: boolean;
}

export function HelpButton({ className, showLabel = false }: HelpButtonProps) {
  const { setIsHelpOpen, completionPercentage, hasCompletedOnboarding } = useOnboarding();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={showLabel ? 'sm' : 'icon'}
            onClick={() => setIsHelpOpen(true)}
            className={cn('relative', className)}
          >
            <HelpCircle className="h-5 w-5" />
            {showLabel && <span className="ml-2">Help</span>}
            {!hasCompletedOnboarding && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Help & Tutorial ({completionPercentage}% complete)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
