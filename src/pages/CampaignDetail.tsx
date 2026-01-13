import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Mail, MessageSquare, ThumbsUp, MousePointer, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { format } from 'date-fns';

interface CampaignDetails {
  id: string;
  name: string;
  status: string;
  platform: string;
  created_at: string;
}

interface VariantPerformance {
  id: string;
  name: string;
  subject_line: string;
  variant_type: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
}

interface DailyData {
  date: string;
  sent: number;
  opened: number;
  replied: number;
}

interface HourlyData {
  hour: number;
  replies: number;
}

export default function CampaignDetail() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [variants, setVariants] = useState<VariantPerformance[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [totals, setTotals] = useState({ sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id && campaignId) {
      fetchCampaignDetails();
    }
  }, [currentWorkspace?.id, campaignId]);

  const fetchCampaignDetails = async () => {
    if (!currentWorkspace?.id || !campaignId) return;
    setLoading(true);

    try {
      // Try to fetch campaign from SmartLead first, then Reply.io
      let campaignData = null;
      let platform = 'smartlead';
      
      const { data: smartleadCampaign } = await supabase
        .from('smartlead_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (smartleadCampaign) {
        campaignData = smartleadCampaign;
        platform = 'smartlead';
      } else {
        const { data: replyioCampaign } = await supabase
          .from('replyio_campaigns')
          .select('*')
          .eq('id', campaignId)
          .eq('workspace_id', currentWorkspace.id)
          .single();
        
        if (replyioCampaign) {
          campaignData = replyioCampaign;
          platform = 'replyio';
        }
      }

      if (!campaignData) {
        setCampaign(null);
        setLoading(false);
        return;
      }

      setCampaign({ ...campaignData, platform });

      // Fetch daily metrics from the appropriate platform table
      const metricsTable = platform === 'smartlead' ? 'smartlead_daily_metrics' : 'replyio_daily_metrics';
      const { data: metricsData, error: metricsError } = await supabase
        .from(metricsTable)
        .select('*')
        .eq('campaign_id', campaignId)
        .order('metric_date', { ascending: true });

      if (!metricsError && metricsData) {
        const daily: DailyData[] = metricsData.map(m => ({
          date: format(new Date(m.metric_date), 'MMM d'),
          sent: m.sent_count || 0,
          opened: m.opened_count || 0,
          replied: m.replied_count || 0,
        }));
        setDailyData(daily);

        // Calculate totals
        const tots = metricsData.reduce((acc, m) => ({
          sent: acc.sent + (m.sent_count || 0),
          opened: acc.opened + (m.opened_count || 0),
          clicked: acc.clicked + (m.clicked_count || 0),
          replied: acc.replied + (m.replied_count || 0),
          bounced: acc.bounced + (m.bounced_count || 0),
        }), { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 });
        setTotals(tots);
      }

      // Fetch variants from the appropriate platform table
      const variantsTable = platform === 'smartlead' ? 'smartlead_variants' : 'replyio_variants';
      const { data: variantsData, error: variantsError } = await supabase
        .from(variantsTable)
        .select('*')
        .eq('campaign_id', campaignId);

      if (!variantsError && variantsData) {
        // Get metrics per variant
        const { data: variantMetrics } = await supabase
          .from(metricsTable)
          .select('*')
          .eq('campaign_id', campaignId)
          .not('variant_id', 'is', null);

        type MetricRow = {
          variant_id: string | null;
          sent_count: number | null;
          opened_count: number | null;
          clicked_count: number | null;
          replied_count: number | null;
        };

        const variantsWithMetrics: VariantPerformance[] = variantsData.map(v => {
          const vMetrics = ((variantMetrics || []) as MetricRow[]).filter(m => m.variant_id === v.id);
          const sent = vMetrics.reduce((s, m) => s + (m.sent_count || 0), 0);
          const opened = vMetrics.reduce((s, m) => s + (m.opened_count || 0), 0);
          const clicked = vMetrics.reduce((s, m) => s + (m.clicked_count || 0), 0);
          const replied = vMetrics.reduce((s, m) => s + (m.replied_count || 0), 0);

          return {
            id: v.id,
            name: v.name,
            subject_line: v.subject_line || '',
            variant_type: v.variant_type,
            sent,
            opened,
            clicked,
            replied,
            open_rate: sent > 0 ? (opened / sent) * 100 : 0,
            click_rate: sent > 0 ? (clicked / sent) * 100 : 0,
            reply_rate: sent > 0 ? (replied / sent) * 100 : 0,
          };
        });

        setVariants(variantsWithMetrics.sort((a, b) => b.reply_rate - a.reply_rate));
      }

      // Fetch reply events for time-of-day analysis from appropriate platform table
      const eventsTable = platform === 'smartlead' ? 'smartlead_message_events' : 'replyio_message_events';
      const { data: replyEvents } = await supabase
        .from(eventsTable)
        .select('event_timestamp')
        .eq('campaign_id', campaignId)
        .in('event_type', ['reply', 'positive_reply', 'negative_reply']);

      if (replyEvents) {
        const hourCounts: Record<number, number> = {};
        for (let i = 0; i < 24; i++) hourCounts[i] = 0;
        
        replyEvents.forEach(e => {
          const hour = new Date(e.event_timestamp).getHours();
          hourCounts[hour]++;
        });

        const hourly: HourlyData[] = Object.entries(hourCounts).map(([hour, replies]) => ({
          hour: parseInt(hour),
          replies,
        }));
        setHourlyData(hourly);
      }
    } catch (err) {
      console.error('Error fetching campaign details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}${ampm}`;
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/campaigns">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{campaign?.name || 'Campaign Details'}</h1>
            <div className="flex items-center gap-2 mt-1">
              {campaign && (
                <>
                  <Badge variant="outline">{campaign.platform}</Badge>
                  <Badge>{campaign.status}</Badge>
                </>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !campaign ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Campaign not found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{totals.sent.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{totals.sent > 0 ? ((totals.opened / totals.sent) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Open Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MousePointer className="h-4 w-4 text-chart-2" />
                    <span className="text-2xl font-bold">{totals.sent > 0 ? ((totals.clicked / totals.sent) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Click Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold text-success">{totals.sent > 0 ? ((totals.replied / totals.sent) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Reply Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-2xl font-bold text-destructive">{totals.sent > 0 ? ((totals.bounced / totals.sent) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Bounce Rate</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="performance">
              <TabsList>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="variants">Copy Variants</TabsTrigger>
                <TabsTrigger value="timing">Timing</TabsTrigger>
              </TabsList>

              <TabsContent value="performance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Performance Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailyData.length > 0 ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dailyData}>
                            <defs>
                              <linearGradient id="colorSent2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                            <Area type="monotone" dataKey="sent" stroke="hsl(var(--chart-1))" fill="url(#colorSent2)" strokeWidth={2} name="Sent" />
                            <Area type="monotone" dataKey="replied" stroke="hsl(var(--success))" fill="url(#colorReplied)" strokeWidth={2} name="Replied" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No daily data available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variants" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sequence Step Performance</CardTitle>
                    <CardDescription>How each email variant is performing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {variants.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40%]">Subject Line</TableHead>
                            <TableHead>Step</TableHead>
                            <TableHead className="text-right">Sent</TableHead>
                            <TableHead className="text-right">Open Rate</TableHead>
                            <TableHead className="text-right">Click Rate</TableHead>
                            <TableHead className="text-right">Reply Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variants.map((v, idx) => (
                            <TableRow key={v.id}>
                              <TableCell>
                                <p className="font-medium line-clamp-1">{v.subject_line || 'No subject'}</p>
                                <p className="text-xs text-muted-foreground">{v.name}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{v.variant_type}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">{v.sent}</TableCell>
                              <TableCell className="text-right font-mono">{v.open_rate.toFixed(1)}%</TableCell>
                              <TableCell className="text-right font-mono">{v.click_rate.toFixed(1)}%</TableCell>
                              <TableCell className="text-right">
                                <span className={`font-mono ${idx === 0 && v.reply_rate > 0 ? 'text-success font-semibold' : ''}`}>
                                  {v.reply_rate.toFixed(1)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No variant data available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timing" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Reply Time Distribution
                    </CardTitle>
                    <CardDescription>When prospects are most likely to respond</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {hourlyData.some(h => h.replies > 0) ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={hourlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="hour" 
                              tickFormatter={formatHour}
                              stroke="hsl(var(--muted-foreground))" 
                              fontSize={11}
                            />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                              labelFormatter={(label) => `${formatHour(label as number)}`}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar dataKey="replies" name="Replies" fill="hsl(var(--primary))">
                              {hourlyData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.replies === Math.max(...hourlyData.map(h => h.replies)) 
                                    ? 'hsl(var(--success))' 
                                    : 'hsl(var(--primary))'
                                  } 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No reply timing data available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
