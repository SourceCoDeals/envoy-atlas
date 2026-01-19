import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Eye, MousePointer, MessageSquare, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface EmailActivity {
  id: string;
  sent: boolean | null;
  sent_at: string | null;
  opened: boolean | null;
  clicked: boolean | null;
  replied: boolean | null;
  bounced: boolean | null;
  reply_text: string | null;
  reply_sentiment: string | null;
  step_number: number | null;
}

interface ContactEmailHistoryProps {
  contactId: string | null;
}

export function ContactEmailHistory({ contactId }: ContactEmailHistoryProps) {
  const [emails, setEmails] = useState<EmailActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEmails() {
      if (!contactId) {
        setEmails([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('email_activities')
        .select('id, sent, sent_at, opened, clicked, replied, bounced, reply_text, reply_sentiment, step_number')
        .eq('contact_id', contactId)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Error fetching email history:', error);
        setEmails([]);
      } else {
        setEmails((data || []) as EmailActivity[]);
      }
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

  return (
    <div className="space-y-4">
      {emails.map((email) => (
        <Card key={email.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Step {email.step_number || 1}
                </span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {email.sent_at ? format(new Date(email.sent_at), 'MMM d, yyyy h:mm a') : 'Unknown date'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {email.bounced ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Bounced
                  </Badge>
                ) : (
                  <>
                    <Badge variant={email.opened ? 'default' : 'secondary'} className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {email.opened ? 'Opened' : 'Not Opened'}
                    </Badge>
                    {email.clicked && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <MousePointer className="h-3 w-3" />
                        Clicked
                      </Badge>
                    )}
                    {email.replied && (
                      <Badge className="flex items-center gap-1 bg-green-500">
                        <MessageSquare className="h-3 w-3" />
                        Replied
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>

            {email.reply_text && (
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm font-medium">Reply</span>
                  {email.reply_sentiment && (
                    <Badge variant={
                      email.reply_sentiment === 'positive' ? 'default' :
                      email.reply_sentiment === 'negative' ? 'destructive' : 'secondary'
                    }>
                      {email.reply_sentiment}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {email.reply_text.substring(0, 300)}
                  {email.reply_text.length > 300 && '...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
