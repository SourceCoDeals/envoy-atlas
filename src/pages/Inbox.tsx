import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSyncData } from '@/hooks/useSyncData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox as InboxIcon, RefreshCw, Mail, MessageSquare, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface InboxItem {
  id: string;
  to_email: string;
  subject: string | null;
  reply_text: string | null;
  reply_category: string | null;
  reply_sentiment: string | null;
  replied_at: string | null;
  campaign_name: string;
  contact_name: string;
}

export default function Inbox() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { syncing, triggerSync } = useSyncData();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');

  const handleRefresh = async () => {
    await triggerSync();
    fetchInboxItems();
  };

  // Auth not required - public read access enabled

  useEffect(() => {
    if (currentWorkspace?.id) fetchInboxItems();
  }, [currentWorkspace?.id]);

  const fetchInboxItems = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      // Get engagement IDs for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Fetch email activities with replies from the unified schema
      const { data, error } = await supabase
        .from('email_activities')
        .select(`
          id,
          to_email,
          subject,
          reply_text,
          reply_category,
          reply_sentiment,
          replied_at,
          campaign_id,
          campaigns (name)
        `)
        .in('engagement_id', engagementIds)
        .eq('replied', true)
        .order('replied_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const formattedItems: InboxItem[] = (data || []).map((item: any) => ({
        id: item.id,
        to_email: item.to_email,
        subject: item.subject,
        reply_text: item.reply_text,
        reply_category: item.reply_category,
        reply_sentiment: item.reply_sentiment,
        replied_at: item.replied_at,
        campaign_name: item.campaigns?.name || 'Unknown Campaign',
        contact_name: item.to_email?.split('@')[0] || 'Unknown',
      }));

      setItems(formattedItems);
    } catch (err) {
      console.error('Error fetching inbox items:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(item => {
      const sentiment = item.reply_sentiment?.toLowerCase() || '';
      return sentiment.includes(filter);
    });
  }, [items, filter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      positive: items.filter(i => i.reply_sentiment?.toLowerCase().includes('positive')).length,
      negative: items.filter(i => i.reply_sentiment?.toLowerCase().includes('negative')).length,
      neutral: items.filter(i => !i.reply_sentiment || i.reply_sentiment.toLowerCase().includes('neutral')).length,
    };
  }, [items]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Auth not required - public read access enabled

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
            <p className="text-muted-foreground">View and manage email replies</p>
          </div>
          <Button onClick={handleRefresh} disabled={syncing || loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className={`cursor-pointer ${filter === 'all' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('all')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Replies</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'positive' ? 'ring-2 ring-success' : ''}`} onClick={() => setFilter('positive')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive</CardTitle>
              <ThumbsUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.positive}</div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'negative' ? 'ring-2 ring-destructive' : ''}`} onClick={() => setFilter('negative')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negative</CardTitle>
              <ThumbsDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.negative}</div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer ${filter === 'neutral' ? 'ring-2 ring-muted-foreground' : ''}`} onClick={() => setFilter('neutral')}>
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
                  Email replies will appear here once your campaigns receive responses.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{item.to_email}</span>
                            {item.reply_sentiment && (
                              <Badge
                                variant={
                                  item.reply_sentiment.toLowerCase().includes('positive') ? 'default' :
                                  item.reply_sentiment.toLowerCase().includes('negative') ? 'destructive' :
                                  'secondary'
                                }
                              >
                                {item.reply_sentiment}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 truncate">
                            Campaign: {item.campaign_name} • Subject: {item.subject || 'No subject'}
                          </p>
                          {item.reply_text && (
                            <p className="text-sm line-clamp-2">{item.reply_text}</p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.replied_at ? formatDistanceToNow(new Date(item.replied_at), { addSuffix: true }) : '—'}
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
