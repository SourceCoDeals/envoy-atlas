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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Inbox as InboxIcon, 
  Search, 
  Mail, 
  Building2, 
  User, 
  Clock, 
  MessageSquare, 
  Calendar, 
  AlertCircle, 
  Timer,
  Flame,
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, differenceInHours, differenceInMinutes } from 'date-fns';
import { 
  classifyReply, 
  CLASSIFICATION_CONFIG, 
  getPrioritySortOrder,
  type ReplyClassification,
  type PriorityLevel 
} from '@/lib/replyClassification';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
  minutesAgo: number;
  isOverdue: boolean;
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
        .limit(500);

      if (error) throw error;

      const formattedItems: InboxItem[] = (data || []).map((item: any) => {
        const classification = classifyReply(item.reply_content, item.event_type);
        const config = CLASSIFICATION_CONFIG[classification];
        const hoursAgo = differenceInHours(new Date(), new Date(item.occurred_at));
        const minutesAgo = differenceInMinutes(new Date(), new Date(item.occurred_at));
        
        // Calculate if overdue based on target response time
        let isOverdue = false;
        if (config.priority === 'P0' && hoursAgo >= 1) isOverdue = true;
        if (config.priority === 'P1' && hoursAgo >= 4) isOverdue = true;
        if (config.priority === 'P2' && hoursAgo >= 24) isOverdue = true;
        if (config.priority === 'P3' && hoursAgo >= 48) isOverdue = true;
        
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
          minutesAgo,
          isOverdue,
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
    return (
      <Badge className={`${config.bgClass} ${config.textClass} ${config.borderClass} text-xs`}>
        {item.isOverdue && <Timer className="mr-1 h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  const getPriorityIndicator = (priority: PriorityLevel, isOverdue: boolean) => {
    if (isOverdue) {
      return <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />;
    }
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

    if (sortBy === 'priority') {
      result = result.sort((a, b) => {
        // Overdue items first
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        // Then by priority
        const priorityDiff = getPrioritySortOrder(a.priority) - getPrioritySortOrder(b.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
      });
    } else {
      result = result.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    }

    return result;
  }, [items, searchQuery, filter, sortBy]);

  const stats = useMemo(() => {
    const hot = items.filter(i => ['P0', 'P1'].includes(i.priority)).length;
    const action = items.filter(i => ['P2', 'P3'].includes(i.priority)).length;
    const overdue = items.filter(i => i.isOverdue).length;
    
    // Classification breakdown
    const classificationCounts: Record<string, number> = {};
    items.forEach(i => {
      classificationCounts[i.classification] = (classificationCounts[i.classification] || 0) + 1;
    });
    
    return {
      total: items.length,
      hot,
      action,
      overdue,
      classificationCounts,
    };
  }, [items]);

  // Classification chart data
  const classificationChartData = Object.entries(stats.classificationCounts).map(([key, value]) => ({
    name: CLASSIFICATION_CONFIG[key as ReplyClassification]?.label || key,
    value,
    color: key === 'meeting_request' ? 'hsl(var(--success))' : 
           key === 'interested' ? 'hsl(var(--chart-1))' : 
           key === 'question' ? 'hsl(var(--chart-2))' : 
           key === 'not_interested' ? 'hsl(var(--destructive))' : 
           'hsl(var(--muted-foreground))',
  }));

  const getResponseTimeDisplay = (item: InboxItem) => {
    if (item.minutesAgo < 60) {
      return `${item.minutesAgo}m ago`;
    }
    if (item.hoursAgo < 24) {
      return `${item.hoursAgo}h ago`;
    }
    return formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true });
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
            <p className="text-muted-foreground">
              Triage Center – Who needs attention right now?
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchInboxItems}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Row - Priority Based */}
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
          <Card className="border-red-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-red-500" />
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
                <span className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-destructive' : ''}`}>
                  {stats.overdue}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Overdue Responses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-2">
              <div className="h-[60px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classificationChartData.slice(0, 5)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={15}
                      outerRadius={25}
                    >
                      {classificationChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center">Breakdown</p>
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
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'priority' | 'time')}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="time">Recent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="hot" className="text-red-500">
                      <Flame className="h-3 w-3 mr-1" />
                      Hot
                    </TabsTrigger>
                    <TabsTrigger value="action">Action</TabsTrigger>
                    <TabsTrigger value="archive">Archive</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[550px]">
                  {filteredItems.map((item) => {
                    const config = CLASSIFICATION_CONFIG[item.classification];
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-4 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
                          selectedItem?.id === item.id ? 'bg-accent' : ''
                        } ${item.isOverdue ? 'border-l-2 border-l-destructive' : ''}`}
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            {getPriorityIndicator(item.priority, item.isOverdue)}
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
                          {item.reply_content?.substring(0, 80) || 'No content'}
                        </p>
                        <div className="flex items-center justify-between mt-2 pl-4">
                          <span className={`text-xs ${item.isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {getResponseTimeDisplay(item)}
                            {item.isOverdue && ' ⚠️'}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {item.priority}
                          </Badge>
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
                        <Badge variant="outline" className="text-xs">
                          {selectedItem.priority}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Recommended Action Banner */}
                    <div className={`p-3 rounded-lg text-sm mt-2 ${CLASSIFICATION_CONFIG[selectedItem.classification].bgClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowRight className={`h-4 w-4 ${CLASSIFICATION_CONFIG[selectedItem.classification].textClass}`} />
                          <div>
                            <span className="font-medium">Action: </span>
                            <span>{CLASSIFICATION_CONFIG[selectedItem.classification].action}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Target: {CLASSIFICATION_CONFIG[selectedItem.classification].targetResponseTime}
                        </Badge>
                      </div>
                      {selectedItem.isOverdue && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Response overdue – speed wins deals!
                        </p>
                      )}
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
