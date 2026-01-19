import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle, AlertCircle, Pause } from 'lucide-react';

interface EnrollmentData {
  not_started: number;
  in_progress: number;
  completed: number;
  blocked: number;
  paused: number;
  total: number;
}

interface EnrollmentTrackerProps {
  data: EnrollmentData;
  className?: string;
}

export function EnrollmentTracker({ data, className }: EnrollmentTrackerProps) {
  const total = data.total || 1;
  
  const segments = [
    { 
      label: 'Not Started', 
      value: data.not_started, 
      percentage: (data.not_started / total) * 100,
      color: 'bg-muted',
      icon: Clock,
      description: 'Leads waiting to enter sequence'
    },
    { 
      label: 'In Progress', 
      value: data.in_progress, 
      percentage: (data.in_progress / total) * 100,
      color: 'bg-primary',
      icon: Users,
      description: 'Currently receiving emails'
    },
    { 
      label: 'Completed', 
      value: data.completed, 
      percentage: (data.completed / total) * 100,
      color: 'bg-green-500',
      icon: CheckCircle,
      description: 'Finished full sequence'
    },
    { 
      label: 'Blocked', 
      value: data.blocked, 
      percentage: (data.blocked / total) * 100,
      color: 'bg-destructive',
      icon: AlertCircle,
      description: 'Bounced or unsubscribed'
    },
    { 
      label: 'Paused', 
      value: data.paused, 
      percentage: (data.paused / total) * 100,
      color: 'bg-yellow-500',
      icon: Pause,
      description: 'Temporarily stopped'
    },
  ];

  const backlogPercentage = ((data.not_started + data.paused) / total) * 100;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Enrollment Tracker
            </CardTitle>
            <CardDescription>
              Lead distribution across sequence stages
            </CardDescription>
          </div>
          <Badge variant={backlogPercentage > 30 ? 'destructive' : backlogPercentage > 15 ? 'secondary' : 'default'}>
            {backlogPercentage.toFixed(0)}% backlog
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visual Progress Bar */}
        <div className="h-8 rounded-full overflow-hidden flex bg-muted">
          {segments.map((segment, idx) => (
            segment.percentage > 0 && (
              <div
                key={idx}
                className={`${segment.color} transition-all`}
                style={{ width: `${segment.percentage}%` }}
                title={`${segment.label}: ${segment.value.toLocaleString()}`}
              />
            )
          ))}
        </div>

        {/* Segment Details */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {segments.map((segment, idx) => {
            const Icon = segment.icon;
            return (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${segment.color}`} />
                  <span className="text-sm font-medium">{segment.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{segment.value.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">
                    ({segment.percentage.toFixed(1)}%)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{segment.description}</p>
              </div>
            );
          })}
        </div>

        {/* Capacity Alert */}
        {data.not_started > 1000 && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">High Backlog Alert</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {data.not_started.toLocaleString()} leads are waiting to start. Consider increasing sending capacity.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}