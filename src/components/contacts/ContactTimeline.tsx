import { useContactTimeline } from '@/hooks/useContacts';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Send, Eye, MousePointer, MessageSquare, Voicemail, PhoneCall } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ContactTimelineProps {
  contactId: string | null;
}

const EMAIL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sent: Send,
  opened: Eye,
  clicked: MousePointer,
  replied: MessageSquare,
};

export function ContactTimeline({ contactId }: ContactTimelineProps) {
  const { timeline, loading } = useContactTimeline(contactId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timeline.map((item) => (
        <div key={`${item.type}-${item.id}`} className="flex gap-4 p-3 rounded-lg hover:bg-muted/50">
          {/* Icon */}
          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            item.type === 'email' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
          }`}>
            {item.type === 'email' ? (
              (() => {
                const eventType = (item.data.event_type as string) || 'sent';
                const Icon = EMAIL_ICONS[eventType] || Mail;
                return <Icon className="h-5 w-5" />;
              })()
            ) : (
              (item.data.is_connected as boolean) ? (
                <PhoneCall className="h-5 w-5" />
              ) : (item.data.is_voicemail as boolean) ? (
                <Voicemail className="h-5 w-5" />
              ) : (
                <Phone className="h-5 w-5" />
              )
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {item.type === 'email' ? 'Email' : 'Call'}
                </Badge>
                {item.type === 'email' && (
                  <span className="font-medium capitalize">
                    {(item.data.event_type as string) || 'sent'}
                  </span>
                )}
                {item.type === 'call' && (
                  <span className="font-medium">
                    {(item.data.is_connected as boolean) ? 'Connected' : 
                     (item.data.is_voicemail as boolean) ? 'Voicemail' : 
                     (item.data.disposition as string) || 'No Answer'}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {format(new Date(item.timestamp), 'MMM d, yyyy h:mm a')}
              </span>
            </div>

            {/* Details */}
            <div className="mt-1 text-sm text-muted-foreground">
              {item.type === 'call' && (item.data.duration_seconds as number) > 0 && (
                <span>Duration: {Math.floor((item.data.duration_seconds as number) / 60)}m {(item.data.duration_seconds as number) % 60}s</span>
              )}
              {item.type === 'call' && (item.data.call_ai_scores as Array<{ composite_score: number }>)?.[0]?.composite_score && (
                <Badge variant="secondary" className="ml-2">
                  AI Score: {(item.data.call_ai_scores as Array<{ composite_score: number }>)[0].composite_score}
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
