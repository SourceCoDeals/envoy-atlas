import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowRight, CheckCircle, XCircle, Pause, Mail } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from 'recharts';

interface StepData {
  step_number: number;
  step_name: string;
  leads_at_step: number;
  sent: number;
  opened: number;
  replied: number;
  dropped_off: number;
}

interface FinishReasonData {
  reason: string;
  count: number;
}

interface LeadJourneyProps {
  steps: StepData[];
  finishReasons: FinishReasonData[];
  totalLeads: number;
  completedLeads: number;
  activeLeads: number;
  className?: string;
}

export function LeadJourney({ 
  steps, 
  finishReasons, 
  totalLeads,
  completedLeads,
  activeLeads,
  className 
}: LeadJourneyProps) {
  const completionRate = totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0;
  
  // Colors for funnel
  const COLORS = [
    'hsl(var(--primary))',
    'hsl(220 70% 50%)',
    'hsl(200 70% 50%)',
    'hsl(180 70% 50%)',
    'hsl(160 70% 50%)',
    'hsl(140 70% 50%)',
  ];

  const getReasonIcon = (reason: string) => {
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('complete') || lowerReason.includes('finish')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (lowerReason.includes('unsubscribe') || lowerReason.includes('bounce')) return <XCircle className="h-4 w-4 text-destructive" />;
    if (lowerReason.includes('pause') || lowerReason.includes('stop')) return <Pause className="h-4 w-4 text-yellow-500" />;
    return <Mail className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lead Journey Analysis
            </CardTitle>
            <CardDescription>
              Sequence progression and drop-off points
            </CardDescription>
          </div>
          <Badge variant={completionRate >= 50 ? 'default' : completionRate >= 25 ? 'secondary' : 'outline'}>
            {completionRate.toFixed(0)}% completion rate
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{totalLeads.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Leads</div>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 text-center">
            <Mail className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-primary">{activeLeads.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">In Sequence</div>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <div className="text-2xl font-bold text-green-500">{completedLeads.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
        </div>

        {/* Step-by-Step Funnel */}
        <div>
          <h4 className="text-sm font-medium mb-3">Sequence Step Breakdown</h4>
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No step data available</p>
          ) : (
            <div className="space-y-3">
              {steps.map((step, idx) => {
                const prevLeads = idx === 0 ? totalLeads : steps[idx - 1].leads_at_step;
                const dropOffRate = prevLeads > 0 ? ((prevLeads - step.leads_at_step) / prevLeads) * 100 : 0;
                const openRate = step.sent > 0 ? (step.opened / step.sent) * 100 : 0;
                const replyRate = step.sent > 0 ? (step.replied / step.sent) * 100 : 0;
                
                return (
                  <div key={idx} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Step {step.step_number}
                        </Badge>
                        <span className="font-medium text-sm">{step.step_name || `Email ${step.step_number}`}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{step.leads_at_step.toLocaleString()} leads</span>
                        {dropOffRate > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            -{dropOffRate.toFixed(0)}% drop
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Sent:</span>
                        <span className="ml-1 font-medium">{step.sent.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Opens:</span>
                        <span className="ml-1 font-medium">{openRate.toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Replies:</span>
                        <span className="ml-1 font-medium">{replyRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    <Progress 
                      value={(step.leads_at_step / totalLeads) * 100} 
                      className="h-1.5 mt-2"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Finish Reasons */}
        <div>
          <h4 className="text-sm font-medium mb-3">Exit Reasons</h4>
          {finishReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exit reason data available</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {finishReasons.slice(0, 6).map((reason, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {getReasonIcon(reason.reason)}
                    <span className="text-sm truncate max-w-[120px]" title={reason.reason}>
                      {reason.reason || 'Unknown'}
                    </span>
                  </div>
                  <span className="font-medium text-sm">{reason.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}