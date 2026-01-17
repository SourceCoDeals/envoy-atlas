import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Phone, Mail, Eye, MessageSquare, CalendarCheck, 
  Search, Filter, Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'email_sent' | 'email_opened' | 'email_replied' | 'call_attempted' | 'call_connected' | 'meeting_scheduled';
  timestamp: string;
  company: string;
  contact: string;
  details: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface ActivityTimelineTabProps {
  data: {
    recentActivity: ActivityItem[];
    keyMetrics: {
      totalTouchpoints: number;
      emailTouchpoints: number;
      callTouchpoints: number;
    };
  };
}

const activityIcons = {
  email_sent: Mail,
  email_opened: Eye,
  email_replied: MessageSquare,
  call_attempted: Phone,
  call_connected: Phone,
  meeting_scheduled: CalendarCheck,
};

const activityLabels = {
  email_sent: 'Email Sent',
  email_opened: 'Email Opened',
  email_replied: 'Email Reply',
  call_attempted: 'Call Attempted',
  call_connected: 'Call Connected',
  meeting_scheduled: 'Meeting Scheduled',
};

const activityColors = {
  email_sent: 'text-blue-500',
  email_opened: 'text-purple-500',
  email_replied: 'text-green-500',
  call_attempted: 'text-orange-500',
  call_connected: 'text-green-500',
  meeting_scheduled: 'text-primary',
};

export function ActivityTimelineTab({ data }: ActivityTimelineTabProps) {
  const { recentActivity, keyMetrics } = data;
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Filter activities
  const filteredActivities = recentActivity.filter(activity => {
    const matchesSearch = 
      activity.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.details.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || activity.type.includes(typeFilter);

    return matchesSearch && matchesType;
  });

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = format(new Date(activity.timestamp), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, ActivityItem[]>);

  const sortedDates = Object.keys(groupedActivities).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Weekly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Touchpoints</p>
              <p className="text-2xl font-bold">{keyMetrics.totalTouchpoints.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email Activity</p>
              <p className="text-2xl font-bold">{keyMetrics.emailTouchpoints.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Phone className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Call Activity</p>
              <p className="text-2xl font-bold">{keyMetrics.callTouchpoints.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Activity Timeline
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="email">Emails</SelectItem>
                  <SelectItem value="call">Calls</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity found</p>
              <p className="text-sm mt-2">
                {recentActivity.length === 0 
                  ? 'Activity will appear here as outreach occurs.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  
                  <div className="space-y-3">
                    {groupedActivities[date].map(activity => {
                      const Icon = activityIcons[activity.type];
                      const label = activityLabels[activity.type];
                      const colorClass = activityColors[activity.type];

                      return (
                        <div 
                          key={activity.id}
                          className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className={`p-2 rounded-full bg-muted ${colorClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{label}</span>
                              {activity.sentiment && (
                                <Badge 
                                  variant={
                                    activity.sentiment === 'positive' ? 'default' :
                                    activity.sentiment === 'negative' ? 'destructive' : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {activity.sentiment}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              <span className="font-medium text-foreground">{activity.company}</span>
                              {' • '}{activity.contact}
                            </p>
                            {activity.details && (
                              <p className="text-sm text-muted-foreground mt-1 truncate">
                                {activity.details}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(activity.timestamp), 'h:mm a')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
