import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MiniDistributionProps {
  data: number[];
}

export function MiniDistribution({ data }: MiniDistributionProps) {
  const max = Math.max(...data, 1);

  return (
    <TooltipProvider>
      <div className="flex items-end gap-0.5 h-6">
        {data.map((count, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "w-2 rounded-t cursor-help transition-colors",
                  i < 4 && "bg-red-300 hover:bg-red-400",
                  i >= 4 && i < 6 && "bg-yellow-300 hover:bg-yellow-400",
                  i >= 6 && i < 8 && "bg-blue-300 hover:bg-blue-400",
                  i >= 8 && "bg-green-300 hover:bg-green-400",
                )}
                style={{ height: `${Math.max((count / max) * 100, 4)}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Score {i + 1}: {count} calls</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
