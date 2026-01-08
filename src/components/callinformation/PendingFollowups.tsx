import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';

interface PendingFollowup {
  id: string;
  callId: string;
  contactName: string;
  companyName: string;
  taskName: string;
  dueDate: string;
}

interface PendingFollowupsProps {
  followups: PendingFollowup[];
  onMarkComplete: (id: string) => void;
}

function getDueDateBadge(dateStr: string) {
  const date = new Date(dateStr);
  
  if (isPast(date) && !isToday(date)) {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  if (isToday(date)) {
    return <Badge className="bg-yellow-500/10 text-yellow-600">Today</Badge>;
  }
  if (isTomorrow(date)) {
    return <Badge className="bg-blue-500/10 text-blue-600">Tomorrow</Badge>;
  }
  return <Badge variant="outline">{format(date, 'MMM d')}</Badge>;
}

export function PendingFollowups({ followups, onMarkComplete }: PendingFollowupsProps) {
  if (followups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Pending Follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>All caught up!</p>
            <p className="text-sm mt-1">No pending follow-ups</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdueCount = followups.filter(f => isPast(new Date(f.dueDate)) && !isToday(new Date(f.dueDate))).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Pending Follow-ups
          </CardTitle>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {overdueCount} Overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {followups.map((followup) => (
            <div 
              key={followup.id} 
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <p className="font-medium text-sm">{followup.contactName}</p>
                <p className="text-sm text-muted-foreground">{followup.taskName}</p>
                <div className="flex items-center gap-2">
                  {getDueDateBadge(followup.dueDate)}
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onMarkComplete(followup.id)}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Done
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
