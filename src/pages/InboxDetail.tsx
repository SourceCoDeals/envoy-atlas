import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Mail, 
  User, 
  Building, 
  Calendar, 
  ExternalLink, 
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  Hash,
  Link as LinkIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface SmartLeadInboxItem {
  id: string;
  campaign_status: string | null;
  campaign_name: string | null;
  campaign_id: number | null;
  sl_lead_email: string | null;
  sl_email_lead_id: string | null;
  from_email: string | null;
  to_email: string | null;
  to_name: string | null;
  subject: string | null;
  preview_text: string | null;
  reply_body: string | null;
  sent_message_body: string | null;
  time_replied: string | null;
  event_timestamp: string | null;
  sequence_number: number | null;
  event_type: string | null;
  ui_master_inbox_link: string | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  ai_is_positive: boolean | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  created_at: string | null;
  lead_correspondence: unknown;
}

function extractPlainText(htmlOrText: string): string {
  if (!htmlOrText) return '';
  let text = htmlOrText.replace(/<[^>]*>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export default function InboxDetail() {
  const { inboxId } = useParams<{ inboxId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<SmartLeadInboxItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (inboxId) {
      fetchItem();
    }
  }, [inboxId]);

  const fetchItem = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('smartlead_inbox_webhooks')
        .select('*')
        .eq('id', inboxId)
        .single();

      if (error) throw error;
      setItem(data);
    } catch (err) {
      console.error('Error fetching inbox item:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return <Badge className="bg-success/10 text-success border-success/30"><ThumbsUp className="h-3 w-3 mr-1" />Positive</Badge>;
      case 'negative':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30"><ThumbsDown className="h-3 w-3 mr-1" />Negative</Badge>;
      default:
        return <Badge variant="secondary"><Minus className="h-3 w-3 mr-1" />Neutral</Badge>;
    }
  };

  const getCategoryBadge = (category: string | null) => {
    const categoryMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      meeting_request: { label: '📅 Meeting Request', variant: 'default' },
      interested: { label: '✨ Interested', variant: 'default' },
      question: { label: '❓ Question', variant: 'secondary' },
      referral: { label: '👤 Referral', variant: 'secondary' },
      not_now: { label: '⏰ Not Now', variant: 'outline' },
      not_interested: { label: '👎 Not Interested', variant: 'destructive' },
      unsubscribe: { label: '🚫 Unsubscribe', variant: 'destructive' },
      out_of_office: { label: '🏖️ Out of Office', variant: 'secondary' },
      negative_hostile: { label: '⚠️ Hostile', variant: 'destructive' },
      neutral: { label: '➖ Neutral', variant: 'secondary' },
    };
    const config = categoryMap[category || 'neutral'] || categoryMap.neutral;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Reply not found</h3>
          <Button onClick={() => navigate('/inbox')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inbox
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/inbox')} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Reply Details</h1>
            <p className="text-muted-foreground">
              {item.campaign_name || 'Unknown Campaign'}
            </p>
          </div>
          {item.ui_master_inbox_link && (
            <Button asChild variant="outline">
              <a href={item.ui_master_inbox_link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View in SmartLead
              </a>
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Reply Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Reply
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {item.preview_text || extractPlainText(item.reply_body || '') || 'No reply content'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Original Message */}
            {item.sent_message_body && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-5 w-5" />
                    Original Message Sent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-muted-foreground">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {extractPlainText(item.sent_message_body)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Analysis */}
            {item.ai_category && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🤖 AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {getCategoryBadge(item.ai_category)}
                    {getSentimentBadge(item.ai_sentiment)}
                    {item.ai_is_positive && (
                      <Badge className="bg-success text-success-foreground">
                        Positive Reply
                      </Badge>
                    )}
                  </div>
                  {item.ai_reasoning && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground italic">
                        "{item.ai_reasoning}"
                      </p>
                    </div>
                  )}
                  {item.ai_confidence && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Confidence:</span>
                      <div className="flex-1 bg-muted rounded-full h-2 max-w-32">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${(item.ai_confidence * 100)}%` }}
                        />
                      </div>
                      <span>{Math.round(item.ai_confidence * 100)}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.to_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{item.to_name}</p>
                  </div>
                )}
                {item.to_email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reply From</p>
                    <p className="font-medium text-sm break-all">{item.to_email}</p>
                  </div>
                )}
                {item.sl_lead_email && item.sl_lead_email !== item.to_email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Lead Email</p>
                    <p className="font-medium text-sm break-all">{item.sl_lead_email}</p>
                  </div>
                )}
                {item.from_email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sent From</p>
                    <p className="font-medium text-sm break-all">{item.from_email}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Campaign Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Campaign
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{item.campaign_name || 'Unknown'}</p>
                </div>
                {item.campaign_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Campaign ID</p>
                    <p className="font-mono text-sm">{item.campaign_id}</p>
                  </div>
                )}
                {item.campaign_status && (
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant="outline">{item.campaign_status}</Badge>
                  </div>
                )}
                {item.sequence_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sequence Step</p>
                    <p className="font-medium">Step {item.sequence_number}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.time_replied && (
                  <div>
                    <p className="text-sm text-muted-foreground">Replied At</p>
                    <p className="font-medium">
                      {format(new Date(item.time_replied), 'PPp')}
                    </p>
                  </div>
                )}
                {item.created_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Received At</p>
                    <p className="font-medium">
                      {format(new Date(item.created_at), 'PPp')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Identifiers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Identifiers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {item.sl_email_lead_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead ID</span>
                    <span className="font-mono">{item.sl_email_lead_id}</span>
                  </div>
                )}
                {item.event_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event</span>
                    <span className="font-mono">{item.event_type}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
