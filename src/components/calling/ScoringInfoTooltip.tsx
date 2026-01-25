import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Info, Target, MessageSquare, Zap } from 'lucide-react';

interface ScoringInfoTooltipProps {
  variant?: 'icon' | 'button';
}

export function ScoringInfoTooltip({ variant = 'icon' }: ScoringInfoTooltipProps) {
  const content = (
    <div className="space-y-4">
      {/* Outcome-Based */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-medium">Outcomes (50%)</span>
          <Badge variant="outline" className="text-xs ml-auto">Max 8.5 pts</Badge>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 pl-6">
          <li>Decision Maker reached: +2 pts</li>
          <li>Meeting/appointment set: +3 pts</li>
          <li>Genuine interest expressed: +1.5 pts</li>
          <li>Referral obtained: +1 pt</li>
          <li>Follow-up requested: +1 pt</li>
        </ul>
      </div>

      {/* Quality */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-medium">Quality (30%)</span>
          <Badge variant="outline" className="text-xs ml-auto">Max 5 pts</Badge>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 pl-6">
          <li>Call duration: 0-2 pts (scaled to 15min)</li>
          <li>Qualifying info uncovered: +0.5 pts/item</li>
          <li>Objection handling: 0-1.5 pts (from AI score)</li>
        </ul>
      </div>

      {/* Efficiency */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-medium">Efficiency (20%)</span>
          <Badge variant="outline" className="text-xs ml-auto">Max 2 pts</Badge>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 pl-6">
          <li>First-attempt DM connection: +1.5 pts</li>
          <li>Optimal call time (9-11am/2-4pm): +0.5 pts</li>
        </ul>
      </div>

      <div className="pt-2 border-t text-xs text-muted-foreground">
        Final score normalized to 1-10 scale for easy comparison.
      </div>
    </div>
  );

  if (variant === 'button') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            How scores work
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Weighted Composite Scoring</DialogTitle>
            <DialogDescription>
              Calls are scored on outcomes, conversation quality, and efficiency
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Info className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs p-4">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
