import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox as InboxIcon, RefreshCw, Mail, MessageSquare, ThumbsUp, ThumbsDown, Clock, ExternalLink, Calendar, Building, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';

interface SmartLeadInboxItem {
  id: string;
  campaign_status: string | null;
  campaign_name: string | null;
  campaign_id: number | null;
  sl_lead_email: string | null;
  from_email: string | null;
  to_email: string | null;
  to_name: string | null;
  subject: string | null;
  preview_text: string | null;
  reply_body: string | null;
  time_replied: string | null;
  sequence_number: number | null;
  event_type: string | null;
  ui_master_inbox_link: string | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  ai_is_positive: boolean | null;
  ai_confidence: number | null;
  created_at: string | null;
}

type FilterType = 'all' | 'positive' | 'negative' | 'neutral' | 'meeting_request' | 'interested';

export default function Inbox() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [items, setItems] = useState<SmartLeadInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const handleRefresh = () => {
    fetchInboxItems();
  };

  useEffect(() => {
    fetchInboxItems();
  }, []);

  const fetchInboxItems = async () => {
    setLoading(true);
    try {
      // Fetch from smartlead_inbox_webhooks table
      const { data, error } = await supabase
        .from('smartlead_inbox_webhooks')
        .select('*')
        .order('time_replied', { ascending: false, nullsFirst: false })
        .limit(500);

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching inbox items:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'positive') return items.filter(i => i.ai_sentiment === 'positive' || i.ai_is_positive);
    if (filter === 'negative') return items.filter(i => i.ai_sentiment === 'negative');
    if (filter === 'neutral') return items.filter(i => i.ai_sentiment === 'neutral' || !i.ai_sentiment);
    if (filter === 'meeting_request') return items.filter(i => i.ai_category === 'meeting_request');
    if (filter === 'interested') return items.filter(i => i.ai_category === 'interested');
    return items;
  }, [items, filter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      positive: items.filter(i => i.ai_sentiment === 'positive' || i.ai_is_positive).length,
      negative: items.filter(i => i.ai_sentiment === 'negative').length,
      neutral: items.filter(i => i.ai_sentiment === 'neutral' || !i.ai_sentiment).length,
      meetings: items.filter(i => i.ai_category === 'meeting_request').length,
      interested: items.filter(i => i.ai_category === 'interested').length,
    };
  }, [items]);

  const getSentimentBadge = (item: SmartLeadInboxItem) => {
    if (item.ai_is_positive || item.ai_sentiment === 'positive') {
      return <Badge className="bg-success/10 text-success border-success/30">Positive</Badge>;
    }
    if (item.ai_sentiment === 'negative') {
      return <Badge className="bg-destructive/10 text-destructive border-destructive/30">Negative</Badge>;
    }
    return <Badge variant="secondary">Neutral</Badge>;
  };

  const getCategoryBadge = (category: string | null) => {
    const categoryMap: Record<string, { label: string; className: string }> = {
      meeting_request: { label: '📅 Meeting', className: 'bg-primary/10 text-primary border-primary/30' },
      interested: { label: '✨ Interested', className: 'bg-success/10 text-success border-success/30' },
      question: { label: '❓ Question', className: 'bg-warning/10 text-warning border-warning/30' },
      referral: { label: '👤 Referral', className: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
      not_now: { label: '⏰ Not Now', className: 'bg-muted text-muted-foreground' },
      not_interested: { label: '👎 Not Interested', className: 'bg-destructive/10 text-destructive border-destructive/30' },
      unsubscribe: { label: '🚫 Unsubscribe', className: 'bg-destructive/10 text-destructive border-destructive/30' },
      out_of_office: { label: '🏖️ OOO', className: 'bg-muted text-muted-foreground' },
      negative_hostile: { label: '⚠️ Hostile', className: 'bg-destructive/10 text-destructive border-destructive/30' },
    };
    const config = categoryMap[category || ''];
    if (!config) return null;
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const extractPlainText = (htmlOrText: string): string => {
    if (!htmlOrText) return '';
    let text = htmlOrText.replace(/<[^>]*>/g, ' ');
    text = text.replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
            <p className="text-muted-foreground">SmartLead email replies with AI categorization</p>
          </div>
          <Button onClick={handleRefresh} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card className={`cursor-pointer transition-all ${filter === 'all' ? 'ring-2 ring-primary' : 'hover:bg-accent/50'}`} onClick={() => setFilter('all')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${filter === 'meeting_request' ? 'ring-2 ring-primary' : 'hover:bg-accent/50'}`} onClick={() => setFilter('meeting_request')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meetings</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.meetings}</div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${filter === 'interested' ? 'ring-2 ring-success' : 'hover:bg-accent/50'}`} onClick={() => setFilter('interested')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Interested</CardTitle>
              <ThumbsUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.interested}</div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${filter === 'positive' ? 'ring-2 ring-success' : 'hover:bg-accent/50'}`} onClick={() => setFilter('positive')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive</CardTitle>
              <ThumbsUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.positive}</div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${filter === 'negative' ? 'ring-2 ring-destructive' : 'hover:bg-accent/50'}`} onClick={() => setFilter('negative')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negative</CardTitle>
              <ThumbsDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.negative}</div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${filter === 'neutral' ? 'ring-2 ring-muted-foreground' : 'hover:bg-accent/50'}`} onClick={() => setFilter('neutral')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Neutral</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.neutral}</div>
            </CardContent>
          </Card>
        </div>

        {/* Inbox Items */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Replies</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <InboxIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No replies yet</h3>
                <p className="text-muted-foreground">
                  SmartLead replies will appear here when they're received via webhook.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/inbox/${item.id}`)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium truncate flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {item.to_name || item.to_email || item.sl_lead_email || 'Unknown'}
                            </span>
                            {getSentimentBadge(item)}
                            {getCategoryBadge(item.ai_category)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 truncate flex items-center gap-2">
                            <Building className="h-3 w-3" />
                            <span className="truncate">{item.campaign_name || 'Unknown Campaign'}</span>
                            {item.sequence_number && (
                              <span className="text-xs">• Step {item.sequence_number}</span>
                            )}
                            {item.subject && (
                              <span className="text-xs truncate">• {item.subject}</span>
                            )}
                          </p>
                          <p className="text-sm line-clamp-2">
                            {item.preview_text || extractPlainText(item.reply_body || '') || 'No content'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.time_replied ? formatDistanceToNow(new Date(item.time_replied), { addSuffix: true }) : '—'}
                          </div>
                          {item.ui_master_inbox_link && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(item.ui_master_inbox_link!, '_blank');
                              }}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              SmartLead
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
