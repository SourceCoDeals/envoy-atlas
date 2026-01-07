import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Eye, MousePointer, MessageSquare, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface EmailEvent {
  id: string;
  event_type: string;
  occurred_at: string;
  variant_id: string | null;
  campaign_id: string | null;
  sequence_step: number | null;
  reply_content: string | null;
  reply_sentiment: string | null;
}

interface ContactEmailHistoryProps {
  contactId: string | null;
}

export function ContactEmailHistory({ contactId }: ContactEmailHistoryProps) {
  const [emails, setEmails] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEmails() {
      if (!contactId) {
        setEmails([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data } = await supabase
        .from('message_events')
        .select('*')
        .eq('lead_id', contactId)
        .order('occurred_at', { ascending: false });

      setEmails(data || []);
      setLoading(false);
    }

    fetchEmails();
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No email activity
      </div>
    );
  }

  // Group emails by sent events
  const sentEmails = emails.filter(e => e.event_type === 'sent');

  return (
    <div className="space-y-4">
      {sentEmails.map((email) => {
        const relatedEvents = emails.filter(e => 
          e.variant_id === email.variant_id && 
          e.sequence_step === email.sequence_step &&
          e.id !== email.id
        );
        
        const wasOpened = relatedEvents.some(e => e.event_type === 'opened');
        const wasClicked = relatedEvents.some(e => e.event_type === 'clicked');
        const wasReplied = relatedEvents.some(e => e.event_type === 'replied');
        const wasBounced = relatedEvents.some(e => e.event_type === 'bounced');
        const reply = relatedEvents.find(e => e.event_type === 'replied');

        return (
          <Card key={email.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Step {email.sequence_step || 1}
                  </span>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(email.occurred_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {wasBounced ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Bounced
                    </Badge>
                  ) : (
                    <>
                      <Badge variant={wasOpened ? 'default' : 'secondary'} className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {wasOpened ? 'Opened' : 'Not Opened'}
                      </Badge>
                      {wasClicked && (
                        <Badge variant="default" className="flex items-center gap-1">
                          <MousePointer className="h-3 w-3" />
                          Clicked
                        </Badge>
                      )}
                      {wasReplied && (
                        <Badge className="flex items-center gap-1 bg-green-500">
                          <MessageSquare className="h-3 w-3" />
                          Replied
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>

              {reply?.reply_content && (
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">Reply</span>
                    {reply.reply_sentiment && (
                      <Badge variant={
                        reply.reply_sentiment === 'positive' ? 'default' :
                        reply.reply_sentiment === 'negative' ? 'destructive' : 'secondary'
                      }>
                        {reply.reply_sentiment}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {reply.reply_content.substring(0, 300)}
                    {reply.reply_content.length > 300 && '...'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
