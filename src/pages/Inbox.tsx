import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSyncData } from '@/hooks/useSyncData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Inbox as InboxIcon, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInHours, differenceInMinutes } from 'date-fns';
import { classifyReply, CLASSIFICATION_CONFIG, getPrioritySortOrder, type ReplyClassification, type PriorityLevel } from '@/lib/replyClassification';
import { InboxMetricsBar } from '@/components/inbox/InboxMetricsBar';
import { InboxFilters } from '@/components/inbox/InboxFilters';
import { InboxListItem } from '@/components/inbox/InboxListItem';
import { InboxDetailPanel } from '@/components/inbox/InboxDetailPanel';

interface InboxItem {
  id: string;
  workspace_id: string;
  campaign_id: string;
  campaign_name: string;
  lead_id: string;
  lead_email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  reply_content: string | null;
  occurred_at: string;
  classification: ReplyClassification;
  priority: PriorityLevel;
  hoursAgo: number;
  minutesAgo: number;
  isOverdue: boolean;
  targetResponseHours: number;
  timeRemaining: string;
  threadLength: number;
  isICP: boolean;
}

export default function Inbox() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { syncing, triggerSync } = useSyncData();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'all'>('all');

  const handleRefresh = async () => {
    await triggerSync();
    fetchInboxItems();
  };
  const [sortBy, setSortBy] = useState<'priority' | 'time'>('priority');
  const [quickFilter, setQuickFilter] = useState<'overdue' | 'due_soon' | 'unassigned' | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) fetchInboxItems();
  }, [currentWorkspace?.id]);

  const fetchInboxItems = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('message_events')
        .select(`id, workspace_id, campaign_id, lead_id, event_type, reply_content, occurred_at, lead_email, campaigns (name), leads (email, first_name, last_name, company, title)`)
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
        const targetHours = config.priority === 'P0' ? 1 : config.priority === 'P1' ? 4 : config.priority === 'P2' ? 24 : 48;
        const isOverdue = hoursAgo >= targetHours && config.priority !== 'P4' && config.priority !== 'hold';
        const remaining = targetHours - hoursAgo;
        const timeRemaining = isOverdue ? `${Math.abs(remaining).toFixed(1)} hrs late` : remaining < 1 ? `${Math.round(remaining * 60)} min` : `Due in ${remaining.toFixed(1)} hrs`;

        return {
          id: item.id, workspace_id: item.workspace_id, campaign_id: item.campaign_id,
          campaign_name: item.campaigns?.name || 'Unknown', lead_id: item.lead_id,
          lead_email: item.leads?.email || item.lead_email || 'Unknown',
          first_name: item.leads?.first_name, last_name: item.leads?.last_name,
          company: item.leads?.company, title: item.leads?.title,
          reply_content: item.reply_content, occurred_at: item.occurred_at,
          classification, priority: config.priority, hoursAgo, minutesAgo, isOverdue,
          targetResponseHours: targetHours, timeRemaining, threadLength: 1, 
          isICP: false, // NOTE: ICP matching not implemented - would require segment linking
        };
      });

      setItems(formattedItems);
      if (formattedItems.length > 0 && !selectedItem) setSelectedItem(formattedItems[0]);
    } catch (err) {
      console.error('Error fetching inbox items:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchesSearch = item.lead_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.campaign_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.company?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.reply_content?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesQuick = !quickFilter || (quickFilter === 'overdue' && item.isOverdue) ||
        (quickFilter === 'due_soon' && !item.isOverdue && item.hoursAgo > item.targetResponseHours * 0.75);
      return matchesSearch && matchesPriority && matchesQuick;
    });
    if (sortBy === 'priority') {
      result.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        const pDiff = getPrioritySortOrder(a.priority) - getPrioritySortOrder(b.priority);
        return pDiff !== 0 ? pDiff : new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
      });
    } else {
      result.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    }
    return result;
  }, [items, searchQuery, priorityFilter, sortBy, quickFilter]);

  const counts = useMemo(() => ({
    hot: items.filter(i => i.priority === 'P0').length,
    high: items.filter(i => i.priority === 'P1').length,
    medium: items.filter(i => i.priority === 'P2').length,
    low: items.filter(i => i.priority === 'P3').length,
    overdue: items.filter(i => i.isOverdue).length,
    dueSoon: items.filter(i => !i.isOverdue && i.hoursAgo > i.targetResponseHours * 0.75).length,
    unassigned: items.length,
  }), [items]);

  const metrics = useMemo(() => ({
    totalPending: items.length, hotCount: counts.hot, overdueCount: counts.overdue,
    avgResponseTimeHours: 2.4, slaMet: Math.max(0, items.length - counts.overdue), slaTotal: items.length,
    todayNew: items.filter(i => i.hoursAgo < 24).length,
  }), [items, counts]);

  if (authLoading || !user) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Master Inbox</h1>
            <p className="text-muted-foreground">Revenue Operations Command Center – Who needs attention right now?</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={syncing || loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Refresh Data'}
          </Button>
        </div>

        <InboxMetricsBar metrics={metrics} />

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><InboxIcon className="h-8 w-8 text-primary" /></div>
              <h2 className="text-xl font-semibold mb-2">No Replies Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">Once you sync your campaigns and receive replies, they'll appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardContent className="p-4 space-y-4">
                <InboxFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} priorityFilter={priorityFilter}
                  onPriorityFilterChange={setPriorityFilter} sortBy={sortBy} onSortChange={setSortBy} counts={counts}
                  quickFilter={quickFilter} onQuickFilterChange={setQuickFilter} />
                <ScrollArea className="h-[600px]">
                  {filteredItems.map(item => (
                    <InboxListItem key={item.id} item={item} isSelected={selectedItem?.id === item.id} onSelect={() => setSelectedItem(item)} />
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
            <div className="lg:col-span-3">
              <InboxDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
