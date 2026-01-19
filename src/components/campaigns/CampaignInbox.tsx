import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Mail, RefreshCw, User, Building, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

interface InboxItem {
  id: string;
  lead_email: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  event_type: string;
  reply_content: string | null;
  reply_sentiment: string | null;
  sequence_step: number | null;
  occurred_at: string;
  subject_line: string | null;
  variant_name: string | null;
}

interface CampaignInboxProps {
  campaignId: string;
  platform: 'smartlead' | 'replyio';
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-success/10 text-success border-success/30',
  interested: 'bg-success/10 text-success border-success/30',
  negative: 'bg-destructive/10 text-destructive border-destructive/30',
  not_interested: 'bg-destructive/10 text-destructive border-destructive/30',
  neutral: 'bg-muted text-muted-foreground',
  out_of_office: 'bg-warning/10 text-warning border-warning/30',
};

export function CampaignInbox({ campaignId, platform }: CampaignInboxProps) {
  const { currentWorkspace } = useWorkspace();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchInboxItems = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Query responses table for campaign replies
      const { data: responses, error } = await supabase
        .from('responses')
        .select(`
          id,
          response_type,
          sentiment,
          reply_text,
          received_at,
          contact_id,
          contacts(email, first_name, last_name, title, companies(name))
        `)
        .eq('campaign_id', campaignId)
        .order('received_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching responses:', error);
        setItems([]);
        setLoading(false);
        return;
      }

      // Transform responses to match InboxItem interface
      const transformedItems: InboxItem[] = (responses || []).map((resp: any) => ({
        id: resp.id,
        lead_email: resp.contacts?.email || null,
        first_name: resp.contacts?.first_name || null,
        last_name: resp.contacts?.last_name || null,
        company: resp.contacts?.companies?.name || null,
        title: resp.contacts?.title || null,
        event_type: resp.response_type || 'reply',
        reply_content: resp.reply_text || null,
        reply_sentiment: resp.sentiment || null,
        sequence_step: null,
        occurred_at: resp.received_at || resp.created_at,
        subject_line: null,
        variant_name: null,
      }));

      setItems(transformedItems);
    } catch (e) {
      console.error('Inbox fetch error:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInboxItems();
  }, [campaignId, platform, currentWorkspace?.id]);

  const getSentimentBadge = (sentiment: string | null, eventType: string) => {
    const label = sentiment || eventType.replace(/_/g, ' ');
    const colorClass = sentimentColors[sentiment || eventType] || sentimentColors.neutral;
    return <Badge variant="outline" className={colorClass}>{label}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Campaign Responses
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-2">{items.length}</Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchInboxItems} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No responses yet</p>
            <p className="text-xs mt-1">Replies will appear here when prospects respond</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    expandedId === item.id ? 'bg-accent border-accent-foreground/20' : 'bg-card hover:bg-accent/50'
                  }`}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">
                          {item.first_name || item.last_name 
                            ? `${item.first_name || ''} ${item.last_name || ''}`.trim()
                            : item.lead_email || 'Unknown'
                          }
                        </span>
                        {getSentimentBadge(item.reply_sentiment, item.event_type)}
                      </div>
                      {item.company && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Building className="h-3 w-3" />
                          <span className="truncate">{item.company}</span>
                          {item.title && <span className="truncate">• {item.title}</span>}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {item.subject_line && <span className="font-medium">Re: {item.subject_line}</span>}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                      <div>{format(new Date(item.occurred_at), 'MMM d')}</div>
                      <div>{format(new Date(item.occurred_at), 'h:mm a')}</div>
                      {item.sequence_step && (
                        <Badge variant="outline" className="mt-1">Step {item.sequence_step}</Badge>
                      )}
                    </div>
                  </div>
                  
                  {expandedId === item.id && item.reply_content && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm whitespace-pre-wrap">{item.reply_content}</p>
                      {item.lead_email && (
                        <Button variant="outline" size="sm" className="mt-3" asChild>
                          <a href={`mailto:${item.lead_email}`}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Reply in Email
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
