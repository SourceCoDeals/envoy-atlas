import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ThumbsUp, 
  ChevronDown, 
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PositiveRepliesProps {
  count: number;
  rate: number;
  samples: { lead_id: string; snippet: string; timestamp: string }[];
}

export function CampaignPositiveReplies({ count, rate, samples }: PositiveRepliesProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-success" />
              Positive Responses
            </CardTitle>
            {samples.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-success">{count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Positive Replies</p>
              </div>
              <div className="text-right">
                <Badge className="bg-success/10 text-success border-success/30 text-lg px-3 py-1">
                  {rate.toFixed(2)}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Positive Rate</p>
              </div>
            </div>

            {samples.length > 0 && !isOpen && (
              <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground line-clamp-2 italic">
                    "{samples[0].snippet}..."
                  </p>
                </div>
              </div>
            )}
          </div>

          <CollapsibleContent>
            <div className="border-t mt-4 pt-4 space-y-3 max-h-[300px] overflow-y-auto">
              {samples.map((sample, i) => (
                <div 
                  key={i} 
                  className="p-3 bg-success/5 border border-success/20 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium">Lead: {sample.lead_id.slice(0, 8)}...</span>
                    <span>
                      {sample.timestamp 
                        ? formatDistanceToNow(new Date(sample.timestamp), { addSuffix: true })
                        : 'Unknown time'
                      }
                    </span>
                  </div>
                  <p className="text-sm italic">"{sample.snippet}"</p>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
