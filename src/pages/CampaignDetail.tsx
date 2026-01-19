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
  campaign_type: string;
  created_at: string;
}

interface VariantPerformance {
  id: string;
  name: string;
  subject_line: string;
  step_number: number | null;
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
      // Fetch campaign from campaigns table
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaignData) {
        setCampaign(null);
        setLoading(false);
        return;
      }

      setCampaign({
        id: campaignData.id,
        name: campaignData.name,
        status: campaignData.status || 'active',
        campaign_type: campaignData.campaign_type,
        created_at: campaignData.created_at || '',
      });

      // Set totals from campaign data
      setTotals({
        sent: campaignData.total_sent || 0,
        opened: campaignData.total_opened || 0,
        clicked: 0,
        replied: campaignData.total_replied || 0,
        bounced: campaignData.total_bounced || 0,
      });

      // Fetch daily metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('date', { ascending: true });

      if (!metricsError && metricsData) {
        const daily: DailyData[] = metricsData.map(m => ({
          date: format(new Date(m.date), 'MMM d'),
          sent: m.emails_sent || 0,
          opened: m.emails_opened || 0,
          replied: m.emails_replied || 0,
        }));
        setDailyData(daily);
      }

      // Fetch variants from campaign_variants
      const { data: variantsData, error: variantsError } = await supabase
        .from('campaign_variants')
        .select('*')
        .eq('campaign_id', campaignId);

      if (!variantsError && variantsData) {
        const variantsWithMetrics: VariantPerformance[] = variantsData.map(v => {
          const sent = v.total_sent || 0;
          const opened = v.total_opened || 0;
          const clicked = v.total_clicked || 0;
          const replied = v.total_replied || 0;

          return {
            id: v.id,
            name: v.external_id || 'Variant',
            subject_line: v.subject_line || '',
            step_number: v.step_number,
            sent,
            opened,
            clicked,
            replied,
            open_rate: v.open_rate || (sent > 0 ? (opened / sent) * 100 : 0),
            click_rate: v.click_rate || (sent > 0 ? (clicked / sent) * 100 : 0),
            reply_rate: v.reply_rate || (sent > 0 ? (replied / sent) * 100 : 0),
          };
        });

        setVariants(variantsWithMetrics.sort((a, b) => b.reply_rate - a.reply_rate));
      }

      // Initialize hourly data (empty since we don't have event-level data in the new schema)
      setHourlyData(Array.from({ length: 24 }, (_, i) => ({ hour: i, replies: 0 })));

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
                  <Badge variant="outline">{campaign.campaign_type}</Badge>
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
                    <MessageSquare className="h-4 w-4 text-green-500" />
                    <span className="text-2xl font-bold text-green-500">{totals.sent > 0 ? ((totals.replied / totals.sent) * 100).toFixed(1) : 0}%</span>
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
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                            <Area type="monotone" dataKey="replied" stroke="hsl(var(--primary))" fill="url(#colorReplied)" strokeWidth={2} name="Replied" />
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
                                <Badge variant="outline">{v.step_number || 'N/A'}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">{v.sent}</TableCell>
                              <TableCell className="text-right font-mono">{v.open_rate.toFixed(1)}%</TableCell>
                              <TableCell className="text-right font-mono">{v.click_rate.toFixed(1)}%</TableCell>
                              <TableCell className="text-right">
                                <span className={`font-mono ${idx === 0 && v.reply_rate > 0 ? 'text-green-500 font-semibold' : ''}`}>
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
                              fontSize={10}
                            />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                              labelFormatter={(hour) => formatHour(hour as number)}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar dataKey="replies" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Replies" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No timing data available yet</p>
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