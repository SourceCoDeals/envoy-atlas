import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCampaignSummary } from '@/hooks/useCampaignSummary';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Mail, MessageSquare, ThumbsUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CampaignInfrastructure } from '@/components/campaigns/CampaignInfrastructure';
import { CampaignBounceAnalysis } from '@/components/campaigns/CampaignBounceAnalysis';
import { CampaignLeadBreakdown } from '@/components/campaigns/CampaignLeadBreakdown';
import { CampaignPositiveReplies } from '@/components/campaigns/CampaignPositiveReplies';
import { CampaignInbox } from '@/components/campaigns/CampaignInbox';

export default function CampaignSummary() {
  const { campaignId, platform } = useParams<{ campaignId: string; platform?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const validPlatform = platform === 'smartlead' || platform === 'replyio' ? platform : undefined;
  const { data, loading, error, refetch } = useCampaignSummary(campaignId, validPlatform);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { campaign, metrics, infrastructure, bounceAnalysis, leadBreakdown, positiveReplies, variants, sequenceSteps, dailyData } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{campaign?.name || 'Campaign Summary'}</h1>
              <div className="flex items-center gap-2 mt-1">
                {campaign && (
                  <>
                    <Badge variant="outline">{campaign.platform}</Badge>
                    <Badge>{campaign.status}</Badge>
                    <span className="text-sm text-muted-foreground">
                      Created {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card><CardContent className="py-12 text-center text-destructive">{error}</CardContent></Card>
        ) : !campaign ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Campaign not found</CardContent></Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{metrics.total_sent.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <span className="text-2xl font-bold">{metrics.delivery_rate.toFixed(1)}%</span>
                  <p className="text-xs text-muted-foreground">Delivery Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <span className="text-2xl font-bold">{metrics.open_rate.toFixed(1)}%</span>
                  <p className="text-xs text-muted-foreground">Open Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold text-success">{metrics.reply_rate.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Reply Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold text-success">{metrics.positive_rate.toFixed(2)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Positive Rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Infrastructure & Domain Health */}
            <CampaignInfrastructure
              inboxes={infrastructure.inboxes}
              domains={infrastructure.domains}
              totalDailyCapacity={infrastructure.total_daily_capacity}
              warmupCount={infrastructure.warmup_count}
            />

            {/* Campaign Inbox */}
            {campaignId && validPlatform && (
              <CampaignInbox campaignId={campaignId} platform={validPlatform} />
            )}

            {/* Bounce, Leads, Positive Replies */}
            <div className="grid gap-4 md:grid-cols-3">
              <CampaignBounceAnalysis
                hardBounces={bounceAnalysis.hard_bounces}
                softBounces={bounceAnalysis.soft_bounces}
                totalSent={metrics.total_sent}
                bounceRate={metrics.bounce_rate}
                byReason={bounceAnalysis.by_reason}
                byDomain={bounceAnalysis.by_domain}
                byInbox={bounceAnalysis.by_inbox}
              />
              <CampaignLeadBreakdown total={leadBreakdown.total} byStatus={leadBreakdown.by_status} />
              <CampaignPositiveReplies count={positiveReplies.count} rate={positiveReplies.rate} samples={positiveReplies.samples} />
            </div>

            {/* Tabs for deeper analysis */}
            <Tabs defaultValue="performance">
              <TabsList>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="variants">Copy Variants</TabsTrigger>
                <TabsTrigger value="sequence">Sequence Steps</TabsTrigger>
              </TabsList>

              <TabsContent value="performance">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Performance Over Time</CardTitle></CardHeader>
                  <CardContent>
                    {dailyData.length > 0 ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dailyData.map(d => ({ ...d, date: format(new Date(d.date), 'MMM d') }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="sent" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1) / 0.2)" name="Sent" />
                            <Area type="monotone" dataKey="replied" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.2)" name="Replied" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-center text-muted-foreground py-8">No daily data</p>}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variants">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Copy Variant Performance</CardTitle></CardHeader>
                  <CardContent>
                    {variants.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject Line</TableHead>
                            <TableHead className="text-right">Sent</TableHead>
                            <TableHead className="text-right">Open %</TableHead>
                            <TableHead className="text-right">Reply %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variants.map(v => (
                            <TableRow key={v.id}>
                              <TableCell className="font-medium">{v.subject_line || v.name}</TableCell>
                              <TableCell className="text-right">{v.sent}</TableCell>
                              <TableCell className="text-right">{v.open_rate.toFixed(1)}%</TableCell>
                              <TableCell className="text-right text-success">{v.reply_rate.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : <p className="text-center text-muted-foreground py-8">No variant data</p>}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sequence">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Sequence Step Performance</CardTitle></CardHeader>
                  <CardContent>
                    {sequenceSteps.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Step</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Sent</TableHead>
                            <TableHead className="text-right">Open %</TableHead>
                            <TableHead className="text-right">Reply %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sequenceSteps.map(s => (
                            <TableRow key={s.step_number}>
                              <TableCell>Step {s.step_number}</TableCell>
                              <TableCell><Badge variant="outline">{s.step_type}</Badge></TableCell>
                              <TableCell className="text-right">{s.sent}</TableCell>
                              <TableCell className="text-right">{s.open_rate.toFixed(1)}%</TableCell>
                              <TableCell className="text-right text-success">{s.reply_rate.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : <p className="text-center text-muted-foreground py-8">No sequence data</p>}
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
