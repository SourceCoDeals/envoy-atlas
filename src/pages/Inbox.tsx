import { useEffect, useState, useMemo } from 'react';
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
import { Loader2, Inbox as InboxIcon, Search, Mail, Building2, User, Clock, MessageSquare, Calendar, AlertCircle, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { 
  classifyReply, 
  CLASSIFICATION_CONFIG, 
  getPrioritySortOrder,
  type ReplyClassification,
  type PriorityLevel 
} from '@/lib/replyClassification';

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
  classification: ReplyClassification;
  priority: PriorityLevel;
  hoursAgo: number;
}

export default function Inbox() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'hot' | 'action' | 'archive'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'time'>('priority');

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

      const formattedItems: InboxItem[] = (data || []).map((item: any) => {
        const classification = classifyReply(item.reply_content, item.event_type);
        const config = CLASSIFICATION_CONFIG[classification];
        const hoursAgo = differenceInHours(new Date(), new Date(item.occurred_at));
        
        return {
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
          classification,
          priority: config.priority,
          hoursAgo,
        };
      });

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

  const getClassificationBadge = (item: InboxItem) => {
    const config = CLASSIFICATION_CONFIG[item.classification];
    const isOverdue = 
      (item.priority === 'P0' && item.hoursAgo > 1) ||
      (item.priority === 'P1' && item.hoursAgo > 4) ||
      (item.priority === 'P2' && item.hoursAgo > 24);
    
    return (
      <Badge className={`${config.bgClass} ${config.textClass} ${config.borderClass} text-xs`}>
        {isOverdue && <Timer className="mr-1 h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  const getPriorityIndicator = (priority: PriorityLevel) => {
    switch (priority) {
      case 'P0':
        return <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
      case 'P1':
        return <div className="w-2 h-2 rounded-full bg-orange-500" />;
      case 'P2':
        return <div className="w-2 h-2 rounded-full bg-yellow-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />;
    }
  };

  const getEmailTypeBadge = (emailType: string) => {
    if (emailType === 'personal') {
      return <Badge variant="secondary" className="text-xs">Personal</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Work</Badge>;
  };

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchesSearch = 
        item.lead_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.campaign_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.company && item.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.reply_content && item.reply_content.toLowerCase().includes(searchQuery.toLowerCase()));

      if (filter === 'all') return matchesSearch;
      if (filter === 'hot') return matchesSearch && ['P0', 'P1'].includes(item.priority);
      if (filter === 'action') return matchesSearch && ['P2', 'P3'].includes(item.priority);
      if (filter === 'archive') return matchesSearch && ['P4', 'hold'].includes(item.priority);
      return matchesSearch;
    });

    // Sort by priority or time
    if (sortBy === 'priority') {
      result = result.sort((a, b) => {
        const priorityDiff = getPrioritySortOrder(a.priority) - getPrioritySortOrder(b.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
      });
    } else {
      result = result.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    }

    return result;
  }, [items, searchQuery, filter, sortBy]);

  const stats = useMemo(() => ({
    total: items.length,
    hot: items.filter(i => ['P0', 'P1'].includes(i.priority)).length,
    action: items.filter(i => ['P2', 'P3'].includes(i.priority)).length,
    overdue: items.filter(i => {
      if (i.priority === 'P0' && i.hoursAgo > 1) return true;
      if (i.priority === 'P1' && i.hoursAgo > 4) return true;
      if (i.priority === 'P2' && i.hoursAgo > 24) return true;
      return false;
    }).length,
  }), [items]);

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

        {/* Stats Row - Priority Based */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
              <p className="text-xs text-muted-foreground">Total Replies</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-2xl font-bold text-red-500">{stats.hot}</span>
              </div>
              <p className="text-xs text-muted-foreground">Hot Leads (P0-P1)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-500">{stats.action}</span>
              </div>
              <p className="text-xs text-muted-foreground">Needs Action (P2-P3)</p>
            </CardContent>
          </Card>
          <Card className={stats.overdue > 0 ? 'border-destructive/50' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-destructive" />
                <span className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-destructive' : ''}`}>{stats.overdue}</span>
              </div>
              <p className="text-xs text-muted-foreground">Overdue Responses</p>
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
                    <TabsTrigger value="hot" className="text-red-500">🔥 Hot</TabsTrigger>
                    <TabsTrigger value="action">Action</TabsTrigger>
                    <TabsTrigger value="archive">Archive</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {filteredItems.map((item) => {
                    const config = CLASSIFICATION_CONFIG[item.classification];
                    const isOverdue = 
                      (item.priority === 'P0' && item.hoursAgo > 1) ||
                      (item.priority === 'P1' && item.hoursAgo > 4) ||
                      (item.priority === 'P2' && item.hoursAgo > 24);
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-4 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
                          selectedItem?.id === item.id ? 'bg-accent' : ''
                        } ${isOverdue ? 'border-l-2 border-l-destructive' : ''}`}
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            {getPriorityIndicator(item.priority)}
                            <span className="font-medium text-sm truncate">
                              {item.first_name || item.lead_email.split('@')[0]}
                            </span>
                          </div>
                          {getClassificationBadge(item)}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1 pl-4">
                          {item.company || item.email_domain}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-4">
                          {item.reply_content?.substring(0, 100) || 'No content available'}
                        </p>
                        <div className="flex items-center gap-2 mt-2 pl-4">
                          <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true })}
                            {isOverdue && ' (overdue)'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
                        {getClassificationBadge(selectedItem)}
                      </div>
                    </div>
                    
                    {/* Recommended Action Banner */}
                    <div className={`p-3 rounded-lg text-sm ${CLASSIFICATION_CONFIG[selectedItem.classification].bgClass}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Recommended: </span>
                          <span>{CLASSIFICATION_CONFIG[selectedItem.classification].action}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Target: {CLASSIFICATION_CONFIG[selectedItem.classification].targetResponseTime}
                        </Badge>
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
