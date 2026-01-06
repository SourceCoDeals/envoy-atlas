import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Inbox as InboxIcon, Search, Filter, Mail, Building2, User, Clock, MessageSquare, ThumbsUp, ThumbsDown, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';

interface InboxItem {
  id: string;
  workspace_id: string;
  campaign_id: string;
  campaign_name: string;
  lead_id: string;
  lead_email: string;
  email_type: 'personal' | 'work';
  email_domain: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  event_type: string;
  reply_content: string | null;
  reply_sentiment: string | null;
  sequence_step: number | null;
  occurred_at: string;
  created_at: string;
  subject_line: string | null;
  variant_name: string | null;
}

export default function Inbox() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchInboxItems();
    }
  }, [currentWorkspace?.id]);

  const fetchInboxItems = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('message_events')
        .select(`
          id,
          workspace_id,
          campaign_id,
          lead_id,
          event_type,
          reply_content,
          reply_sentiment,
          sequence_step,
          occurred_at,
          created_at,
          lead_email,
          campaigns (name),
          campaign_variants (subject_line, name),
          leads (email, first_name, last_name, company, title, email_type, email_domain)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .in('event_type', ['reply', 'replied', 'positive_reply', 'negative_reply', 'interested', 'not_interested', 'out_of_office'])
        .order('occurred_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const formattedItems: InboxItem[] = (data || []).map((item: any) => ({
        id: item.id,
        workspace_id: item.workspace_id,
        campaign_id: item.campaign_id,
        campaign_name: item.campaigns?.name || 'Unknown Campaign',
        lead_id: item.lead_id,
        lead_email: item.leads?.email || item.lead_email || 'Unknown',
        email_type: item.leads?.email_type || 'work',
        email_domain: item.leads?.email_domain || '',
        first_name: item.leads?.first_name,
        last_name: item.leads?.last_name,
        company: item.leads?.company,
        title: item.leads?.title,
        event_type: item.event_type,
        reply_content: item.reply_content,
        reply_sentiment: item.reply_sentiment,
        sequence_step: item.sequence_step,
        occurred_at: item.occurred_at,
        created_at: item.created_at,
        subject_line: item.campaign_variants?.subject_line,
        variant_name: item.campaign_variants?.name,
      }));

      setItems(formattedItems);
      if (formattedItems.length > 0 && !selectedItem) {
        setSelectedItem(formattedItems[0]);
      }
    } catch (err) {
      console.error('Error fetching inbox items:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentBadge = (eventType: string, sentiment: string | null) => {
    if (eventType === 'positive_reply' || eventType === 'interested' || sentiment === 'interested') {
      return <Badge className="bg-success/20 text-success border-success/30">Positive</Badge>;
    }
    if (eventType === 'negative_reply' || eventType === 'not_interested' || sentiment === 'not_interested') {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Negative</Badge>;
    }
    if (eventType === 'out_of_office') {
      return <Badge variant="secondary">Out of Office</Badge>;
    }
    return <Badge variant="outline">Neutral</Badge>;
  };

  const getEmailTypeBadge = (emailType: string) => {
    if (emailType === 'personal') {
      return <Badge variant="secondary" className="text-xs">Personal</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Work</Badge>;
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.lead_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.campaign_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.company && item.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.reply_content && item.reply_content.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filter === 'all') return matchesSearch;
    if (filter === 'positive') return matchesSearch && (item.event_type === 'positive_reply' || item.event_type === 'interested');
    if (filter === 'negative') return matchesSearch && (item.event_type === 'negative_reply' || item.event_type === 'not_interested');
    return matchesSearch && !['positive_reply', 'negative_reply', 'interested', 'not_interested'].includes(item.event_type);
  });

  const stats = {
    total: items.length,
    positive: items.filter(i => i.event_type === 'positive_reply' || i.event_type === 'interested').length,
    negative: items.filter(i => i.event_type === 'negative_reply' || i.event_type === 'not_interested').length,
    personal: items.filter(i => i.email_type === 'personal').length,
    work: items.filter(i => i.email_type === 'work').length,
  };

  if (authLoading || !user) {
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
            <h1 className="text-2xl font-bold tracking-tight">Master Inbox</h1>
            <p className="text-muted-foreground">All campaign responses in one place</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
              <p className="text-xs text-muted-foreground">Total Replies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-success" />
                <span className="text-2xl font-bold text-success">{stats.positive}</span>
              </div>
              <p className="text-xs text-muted-foreground">Positive</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-destructive" />
                <span className="text-2xl font-bold text-destructive">{stats.negative}</span>
              </div>
              <p className="text-xs text-muted-foreground">Negative</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">{stats.work}</span>
              </div>
              <p className="text-xs text-muted-foreground">Work Emails</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-chart-4" />
                <span className="text-2xl font-bold">{stats.personal}</span>
              </div>
              <p className="text-xs text-muted-foreground">Personal Emails</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <InboxIcon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Replies Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Once you sync your campaigns and receive replies, they'll appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left sidebar - message list */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search replies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="positive">Positive</TabsTrigger>
                    <TabsTrigger value="negative">Negative</TabsTrigger>
                    <TabsTrigger value="neutral">Other</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
                        selectedItem?.id === item.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {item.first_name || item.lead_email.split('@')[0]}
                        </span>
                        {getSentimentBadge(item.event_type, item.reply_sentiment)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-1">
                        {item.company || item.email_domain}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.reply_content?.substring(0, 100) || 'No content available'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {getEmailTypeBadge(item.email_type)}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Right side - message detail */}
            <Card className="lg:col-span-2">
              {selectedItem ? (
                <>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Mail className="h-5 w-5" />
                          {selectedItem.first_name && selectedItem.last_name
                            ? `${selectedItem.first_name} ${selectedItem.last_name}`
                            : selectedItem.lead_email}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {selectedItem.lead_email}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getEmailTypeBadge(selectedItem.email_type)}
                        {getSentimentBadge(selectedItem.event_type, selectedItem.reply_sentiment)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {selectedItem.company && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedItem.company}</span>
                        </div>
                      )}
                      {selectedItem.title && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedItem.title}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(selectedItem.occurred_at), 'PPpp')}
                        </span>
                      </div>
                      {selectedItem.sequence_step && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Step {selectedItem.sequence_step}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Campaign</p>
                      <p className="text-sm font-medium">{selectedItem.campaign_name}</p>
                      {selectedItem.subject_line && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Subject: {selectedItem.subject_line}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Reply Content</p>
                      <div className="p-4 rounded-lg border bg-background">
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedItem.reply_content || 'No reply content captured'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-[500px] text-muted-foreground">
                  Select a reply to view details
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
