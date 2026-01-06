import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Users, 
  Building2, 
  Briefcase, 
  Mail, 
  TrendingUp, 
  BarChart3,
  Globe,
  Target,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowUpDown,
} from 'lucide-react';
import { useAudienceAnalytics } from '@/hooks/useAudienceAnalytics';
import { StatisticalConfidenceBadge } from '@/components/dashboard/StatisticalConfidenceBadge';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';

export default function AudienceInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    segments, 
    titles, 
    industries, 
    companySizes, 
    domains, 
    icpInsights,
    totalLeads, 
    loading, 
    error 
  } = useAudienceAnalytics();
  const [activeTab, setActiveTab] = useState('overview');

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

  const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

  const pieColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const getSeniorityBadge = (seniority: string) => {
    const colors: Record<string, string> = {
      executive: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
      vp: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      director: 'bg-green-500/20 text-green-500 border-green-500/30',
      manager: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      individual: 'bg-muted text-muted-foreground border-border',
    };
    return <Badge className={`text-xs ${colors[seniority] || colors.individual}`}>{seniority}</Badge>;
  };

  const getInsightIcon = (confidence: string) => {
    if (confidence === 'hypothesis_confirmed') return <CheckCircle className="h-5 w-5 text-success" />;
    if (confidence === 'hypothesis_refined') return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const hasData = totalLeads > 0;

  // Prepare chart data
  const emailTypeData = segments.filter(s => s.segment_type === 'email_type');
  
  const seniorityData = titles.reduce((acc, t) => {
    const existing = acc.find(a => a.seniority === t.seniority);
    if (existing) {
      existing.total += t.total;
      existing.contacted += t.contacted;
      existing.replied += t.replied;
      existing.positive += t.positive;
    } else {
      acc.push({
        seniority: t.seniority,
        total: t.total,
        contacted: t.contacted,
        replied: t.replied,
        positive: t.positive,
        reply_rate: 0,
        positive_rate: 0,
      });
    }
    return acc;
  }, [] as any[]);

  seniorityData.forEach(s => {
    s.reply_rate = s.contacted > 0 ? (s.replied / s.contacted) * 100 : 0;
    s.positive_rate = s.contacted > 0 ? (s.positive / s.contacted) * 100 : 0;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audience Insights</h1>
            <p className="text-muted-foreground">
              The Targeting Truth – Validate your ICP hypotheses with data
            </p>
          </div>
        </div>

        {!hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Audience Data Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Sync your campaigns to see audience insights and performance breakdowns.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{totalLeads.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total Leads Tracked</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-chart-1" />
                    <span className="text-2xl font-bold">{titles.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Unique Titles</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-chart-2" />
                    <span className="text-2xl font-bold">{industries.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Industries</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-chart-3" />
                    <span className="text-2xl font-bold">{domains.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Email Domains</p>
                </CardContent>
              </Card>
            </div>

            {/* ICP Insights */}
            {icpInsights.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">ICP Validation</CardTitle>
                  </div>
                  <CardDescription>Data-driven insights about your ideal customer profile</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {icpInsights.map((insight, i) => (
                      <div 
                        key={i} 
                        className={`p-4 rounded-lg border ${
                          insight.confidence === 'hypothesis_confirmed' 
                            ? 'bg-success/5 border-success/30' 
                            : insight.confidence === 'hypothesis_refined'
                            ? 'bg-yellow-500/5 border-yellow-500/30'
                            : 'bg-destructive/5 border-destructive/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {getInsightIcon(insight.confidence)}
                          <div>
                            <p className="font-medium text-sm">{insight.dimension}</p>
                            <p className="text-sm mt-1">{insight.finding}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {insight.data_point}
                            </p>
                            <div className="mt-3 p-2 rounded bg-background/50">
                              <p className="text-xs font-medium text-primary">Recommendation:</p>
                              <p className="text-xs text-muted-foreground">{insight.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="titles">By Title</TabsTrigger>
                <TabsTrigger value="industry">By Industry</TabsTrigger>
                <TabsTrigger value="size">By Company Size</TabsTrigger>
                <TabsTrigger value="domains">By Domain</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Email Type Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Personal vs Work Emails</CardTitle>
                      <CardDescription>Response rates by email type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={emailTypeData}
                                dataKey="total_leads"
                                nameKey="segment"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ segment, total_leads }) => `${segment}: ${total_leads}`}
                              >
                                {emailTypeData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-4">
                          {emailTypeData.map(stat => (
                            <div key={stat.segment} className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium capitalize">{stat.segment}</span>
                                <Badge variant="outline">{stat.total_leads} leads</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Reply Rate</p>
                                  <p className="font-mono">{formatRate(stat.reply_rate)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Positive Rate</p>
                                  <p className="font-mono text-success">{formatRate(stat.positive_rate)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Seniority Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Performance by Seniority</CardTitle>
                      <CardDescription>Reply rates across organizational levels</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={seniorityData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="seniority" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rate']}
                            />
                            <Bar dataKey="reply_rate" name="Reply Rate" fill="hsl(var(--chart-1))" />
                            <Bar dataKey="positive_rate" name="Positive Rate" fill="hsl(var(--success))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="titles" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance by Job Title</CardTitle>
                    <CardDescription>Which titles respond best to your outreach?</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Seniority</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Contacted</TableHead>
                          <TableHead className="text-right">Reply Rate</TableHead>
                          <TableHead className="text-right">Positive Rate</TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {titles.map(t => (
                          <TableRow key={t.title}>
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell>{getSeniorityBadge(t.seniority)}</TableCell>
                            <TableCell className="text-right font-mono">{t.total}</TableCell>
                            <TableCell className="text-right font-mono">{t.contacted}</TableCell>
                            <TableCell className="text-right font-mono">{formatRate(t.reply_rate)}</TableCell>
                            <TableCell className="text-right font-mono text-success">{formatRate(t.positive_rate)}</TableCell>
                            <TableCell>
                              <StatisticalConfidenceBadge sampleSize={t.contacted} size="sm" lowThreshold={50} highThreshold={200} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="industry" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance by Industry</CardTitle>
                    <CardDescription>Which industries are most responsive?</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={industries.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" fontSize={12} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                            <YAxis dataKey="industry" type="category" fontSize={11} width={120} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar dataKey="reply_rate" name="Reply Rate" fill="hsl(var(--chart-1))" />
                            <Bar dataKey="positive_rate" name="Positive Rate" fill="hsl(var(--success))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Industry</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                            <TableHead className="text-right">Reply %</TableHead>
                            <TableHead className="text-right">Positive %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {industries.map(i => (
                            <TableRow key={i.industry}>
                              <TableCell className="font-medium">{i.industry}</TableCell>
                              <TableCell className="text-right font-mono">{i.total}</TableCell>
                              <TableCell className="text-right font-mono">{formatRate(i.reply_rate)}</TableCell>
                              <TableCell className="text-right font-mono text-success">{formatRate(i.positive_rate)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="size" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance by Company Size</CardTitle>
                    <CardDescription>SMB, Mid-Market, or Enterprise – where's the sweet spot?</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={companySizes}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="label" fontSize={10} angle={-20} textAnchor="end" height={60} />
                            <YAxis fontSize={12} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar dataKey="reply_rate" name="Reply Rate" fill="hsl(var(--chart-1))" />
                            <Bar dataKey="positive_rate" name="Positive Rate" fill="hsl(var(--success))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        {companySizes.map(s => (
                          <div key={s.size_category} className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{s.label}</span>
                              <Badge variant="outline">{s.total} leads</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <p className="text-muted-foreground">Contacted</p>
                                <p className="font-mono">{s.contacted}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Reply Rate</p>
                                <p className="font-mono">{formatRate(s.reply_rate)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Positive Rate</p>
                                <p className="font-mono text-success">{formatRate(s.positive_rate)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="domains" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance by Email Domain</CardTitle>
                    <CardDescription>Which domains have the highest engagement?</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domain</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Total Leads</TableHead>
                          <TableHead className="text-right">Replied</TableHead>
                          <TableHead className="text-right">Positive</TableHead>
                          <TableHead className="text-right">Reply Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {domains.map(d => (
                          <TableRow key={d.domain}>
                            <TableCell className="font-medium">{d.domain}</TableCell>
                            <TableCell>
                              <Badge variant={d.email_type === 'personal' ? 'secondary' : 'outline'} className="text-xs">
                                {d.email_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{d.total}</TableCell>
                            <TableCell className="text-right font-mono">{d.replied}</TableCell>
                            <TableCell className="text-right font-mono text-success">{d.positive}</TableCell>
                            <TableCell className="text-right font-mono">{formatRate(d.reply_rate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
