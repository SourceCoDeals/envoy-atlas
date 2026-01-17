import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

interface BounceAnalysisProps {
  hardBounces: number;
  softBounces: number;
  totalSent: number;
  bounceRate: number;
  byReason: { reason: string; count: number; type: 'hard' | 'soft' }[];
  byDomain: { domain: string; count: number; rate: number }[];
  byInbox: { email: string; count: number; rate: number }[];
}

export function CampaignBounceAnalysis({ 
  hardBounces, 
  softBounces, 
  totalSent,
  bounceRate,
  byReason,
  byDomain,
  byInbox,
}: BounceAnalysisProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalBounces = hardBounces + softBounces;
  const threshold = 5; // 5% is a common threshold
  const thresholdPercent = (bounceRate / threshold) * 100;
  const isNearThreshold = thresholdPercent > 80;
  const isOverThreshold = bounceRate >= threshold;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Bounce Analysis
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bounce Rate</p>
                <p className={`text-2xl font-bold ${
                  isOverThreshold ? 'text-destructive' : 
                  isNearThreshold ? 'text-warning' : 'text-foreground'
                }`}>
                  {bounceRate.toFixed(2)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Bounces</p>
                <p className="text-xl font-semibold">{totalBounces.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span className={isNearThreshold ? 'text-warning font-medium' : ''}>
                  {thresholdPercent.toFixed(0)}% of threshold
                </span>
                <span>{threshold}%</span>
              </div>
              <Progress 
                value={Math.min(thresholdPercent, 100)} 
                className={`h-2 ${
                  isOverThreshold ? '[&>div]:bg-destructive' : 
                  isNearThreshold ? '[&>div]:bg-warning' : ''
                }`}
              />
            </div>

            {isNearThreshold && !isOverThreshold && (
              <div className="flex items-center gap-2 text-sm text-warning">
                <AlertTriangle className="h-4 w-4" />
                <span>Approaching threshold — review sending practices</span>
              </div>
            )}

            {/* Hard vs Soft Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Hard Bounces</span>
                  <Badge variant="destructive">{hardBounces}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalBounces > 0 ? ((hardBounces / totalBounces) * 100).toFixed(0) : 0}% of bounces
                </p>
              </div>
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Soft Bounces</span>
                  <Badge className="bg-warning/20 text-warning border-warning/30">{softBounces}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalBounces > 0 ? ((softBounces / totalBounces) * 100).toFixed(0) : 0}% of bounces
                </p>
              </div>
            </div>
          </div>

          <CollapsibleContent>
            <div className="border-t mt-4 pt-4">
              <Tabs defaultValue="reasons">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="reasons">By Reason</TabsTrigger>
                  <TabsTrigger value="domains">By Domain</TabsTrigger>
                  <TabsTrigger value="inboxes" disabled={byInbox.length === 0}>By Inbox</TabsTrigger>
                </TabsList>

                <TabsContent value="reasons" className="space-y-2 mt-4 max-h-[200px] overflow-y-auto">
                  {byReason.length > 0 ? byReason.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <span className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full ${
                          item.type === 'hard' ? 'bg-destructive' : 'bg-warning'
                        }`} />
                        {item.reason}
                      </span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No bounce reason data available
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="domains" className="space-y-2 mt-4 max-h-[200px] overflow-y-auto">
                  {byDomain.length > 0 ? byDomain.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <span className="text-sm font-medium">{item.domain}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{item.count} bounces</span>
                        <Badge variant={item.rate > 5 ? 'destructive' : 'outline'}>
                          {item.rate.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No domain bounce data available
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="inboxes" className="space-y-2 mt-4 max-h-[200px] overflow-y-auto">
                  {byInbox.length > 0 ? byInbox.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <span className="text-sm font-medium truncate">{item.email}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{item.count} bounces</span>
                        <Badge variant={item.rate > 5 ? 'destructive' : 'outline'}>
                          {item.rate.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No inbox bounce data available
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
