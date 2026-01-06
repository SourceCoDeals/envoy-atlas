import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX,
  Mail,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  Activity,
  Inbox,
  Ban,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

interface EmailAccountHealth {
  id: string;
  email_address: string;
  sender_name: string | null;
  daily_limit: number;
  warmup_enabled: boolean;
  is_active: boolean;
  sent_count: number;
  bounce_count: number;
  spam_count: number;
  reply_count: number;
  bounce_rate: number;
  spam_rate: number;
  reply_rate: number;
  health_score: number;
}

interface DomainHealth {
  domain: string;
  spf_status: 'pass' | 'fail' | 'unknown';
  dkim_status: 'pass' | 'fail' | 'unknown';
  dmarc_status: 'pass' | 'fail' | 'unknown';
  accounts_count: number;
  total_sent: number;
  bounce_rate: number;
  spam_rate: number;
}

interface DailyTrend {
  date: string;
  sent: number;
  bounced: number;
  spam: number;
  bounce_rate: number;
  spam_rate: number;
}

// Benchmarks from the guide
const BENCHMARKS = {
  bounce_rate: { good: 5, excellent: 2 },
  spam_rate: { critical: 0.3, warning: 0.1 },
  reply_rate: { good: 5, excellent: 10 },
};

export default function Deliverability() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccountHealth[]>([]);
  const [domains, setDomains] = useState<DomainHealth[]>([]);
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalSent: 0,
    totalBounced: 0,
    totalSpam: 0,
    bounceRate: 0,
    spamRate: 0,
    healthyAccounts: 0,
    warningAccounts: 0,
    criticalAccounts: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchDeliverabilityData();
    }
  }, [currentWorkspace?.id]);

  const fetchDeliverabilityData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Fetch email accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('email_accounts')
        .select('id, email_address, sender_name, daily_limit, warmup_enabled, is_active')
        .eq('workspace_id', currentWorkspace.id);

      if (accountsError) throw accountsError;

      // Fetch daily metrics for the last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
      const { data: metrics, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('date, email_account_id, sent_count, bounced_count, spam_complaint_count, replied_count')
        .eq('workspace_id', currentWorkspace.id)
        .gte('date', thirtyDaysAgo);

      if (metricsError) throw metricsError;

      // Aggregate metrics per email account
      const accountMetrics = new Map<string, { sent: number; bounced: number; spam: number; replied: number }>();
      (accounts || []).forEach(acc => {
        accountMetrics.set(acc.id, { sent: 0, bounced: 0, spam: 0, replied: 0 });
      });

      (metrics || []).forEach(m => {
        if (m.email_account_id && accountMetrics.has(m.email_account_id)) {
          const stats = accountMetrics.get(m.email_account_id)!;
          stats.sent += m.sent_count || 0;
          stats.bounced += m.bounced_count || 0;
          stats.spam += m.spam_complaint_count || 0;
          stats.replied += m.replied_count || 0;
        }
      });

      // Calculate health scores
      const accountsWithHealth: EmailAccountHealth[] = (accounts || []).map(acc => {
        const stats = accountMetrics.get(acc.id) || { sent: 0, bounced: 0, spam: 0, replied: 0 };
        const bounceRate = stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0;
        const spamRate = stats.sent > 0 ? (stats.spam / stats.sent) * 100 : 0;
        const replyRate = stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0;

        // Health score: 100 - (bounce_rate * 10) - (spam_rate * 100), clamped 0-100
        let healthScore = 100 - (bounceRate * 10) - (spamRate * 100);
        healthScore = Math.max(0, Math.min(100, healthScore));

        return {
          id: acc.id,
          email_address: acc.email_address,
          sender_name: acc.sender_name,
          daily_limit: acc.daily_limit || 50,
          warmup_enabled: acc.warmup_enabled || false,
          is_active: acc.is_active,
          sent_count: stats.sent,
          bounce_count: stats.bounced,
          spam_count: stats.spam,
          reply_count: stats.replied,
          bounce_rate: bounceRate,
          spam_rate: spamRate,
          reply_rate: replyRate,
          health_score: healthScore,
        };
      });

      setEmailAccounts(accountsWithHealth.sort((a, b) => a.health_score - b.health_score));

      // Aggregate by domain
      const domainMap = new Map<string, DomainHealth>();
      accountsWithHealth.forEach(acc => {
        const domain = acc.email_address.split('@')[1] || 'unknown';
        if (!domainMap.has(domain)) {
          domainMap.set(domain, {
            domain,
            spf_status: 'unknown',
            dkim_status: 'unknown',
            dmarc_status: 'unknown',
            accounts_count: 0,
            total_sent: 0,
            bounce_rate: 0,
            spam_rate: 0,
          });
        }
        const d = domainMap.get(domain)!;
        d.accounts_count++;
        d.total_sent += acc.sent_count;
        d.bounce_rate = d.total_sent > 0 
          ? ((d.bounce_rate * (d.total_sent - acc.sent_count) + acc.bounce_rate * acc.sent_count) / d.total_sent)
          : acc.bounce_rate;
        d.spam_rate = d.total_sent > 0
          ? ((d.spam_rate * (d.total_sent - acc.sent_count) + acc.spam_rate * acc.sent_count) / d.total_sent)
          : acc.spam_rate;
      });

      setDomains(Array.from(domainMap.values()).sort((a, b) => b.total_sent - a.total_sent));

      // Daily trends
      const trendMap = new Map<string, DailyTrend>();
      (metrics || []).forEach(m => {
        const date = m.date;
        if (!trendMap.has(date)) {
          trendMap.set(date, { date, sent: 0, bounced: 0, spam: 0, bounce_rate: 0, spam_rate: 0 });
        }
        const t = trendMap.get(date)!;
        t.sent += m.sent_count || 0;
        t.bounced += m.bounced_count || 0;
        t.spam += m.spam_complaint_count || 0;
      });

      const trends = Array.from(trendMap.values())
        .map(t => ({
          ...t,
          bounce_rate: t.sent > 0 ? (t.bounced / t.sent) * 100 : 0,
          spam_rate: t.sent > 0 ? (t.spam / t.sent) * 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyTrends(trends);

      // Overall stats
      const totals = accountsWithHealth.reduce(
        (acc, a) => ({
          sent: acc.sent + a.sent_count,
          bounced: acc.bounced + a.bounce_count,
          spam: acc.spam + a.spam_count,
        }),
        { sent: 0, bounced: 0, spam: 0 }
      );

      setOverallStats({
        totalSent: totals.sent,
        totalBounced: totals.bounced,
        totalSpam: totals.spam,
        bounceRate: totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0,
        spamRate: totals.sent > 0 ? (totals.spam / totals.sent) * 100 : 0,
        healthyAccounts: accountsWithHealth.filter(a => a.health_score >= 80).length,
        warningAccounts: accountsWithHealth.filter(a => a.health_score >= 50 && a.health_score < 80).length,
        criticalAccounts: accountsWithHealth.filter(a => a.health_score < 50).length,
      });
    } catch (err) {
      console.error('Error fetching deliverability data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" />Healthy</Badge>;
    if (score >= 50) return <Badge className="bg-warning/20 text-warning border-warning/30"><AlertTriangle className="w-3 h-3 mr-1" />Warning</Badge>;
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />Critical</Badge>;
  };

  const getAuthBadge = (status: 'pass' | 'fail' | 'unknown') => {
    if (status === 'pass') return <Badge className="bg-success/20 text-success border-success/30">Pass</Badge>;
    if (status === 'fail') return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Fail</Badge>;
    return <Badge variant="outline">Unknown</Badge>;
  };

  const getRateBadge = (rate: number, type: 'bounce' | 'spam') => {
    if (type === 'bounce') {
      if (rate <= BENCHMARKS.bounce_rate.excellent) return <Badge className="bg-success/20 text-success border-success/30">Excellent</Badge>;
      if (rate <= BENCHMARKS.bounce_rate.good) return <Badge className="bg-warning/20 text-warning border-warning/30">OK</Badge>;
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">High</Badge>;
    }
    if (rate >= BENCHMARKS.spam_rate.critical) return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Critical</Badge>;
    if (rate >= BENCHMARKS.spam_rate.warning) return <Badge className="bg-warning/20 text-warning border-warning/30">Warning</Badge>;
    return <Badge className="bg-success/20 text-success border-success/30">Safe</Badge>;
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasData = emailAccounts.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deliverability</h1>
          <p className="text-muted-foreground">
            Monitor domain health, authentication, and inbox placement
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Email Accounts Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Sync your Smartlead data to monitor deliverability health for your email accounts.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overall Health Cards */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{overallStats.totalSent.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Emails Sent (30d)</p>
                </CardContent>
              </Card>
              <Card className={overallStats.bounceRate > BENCHMARKS.bounce_rate.good ? 'border-destructive/50' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-destructive" />
                    <span className="text-2xl font-bold">{overallStats.bounceRate.toFixed(2)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Bounce Rate</p>
                  <p className="text-xs text-muted-foreground mt-1">Target: &lt;{BENCHMARKS.bounce_rate.good}%</p>
                </CardContent>
              </Card>
              <Card className={overallStats.spamRate >= BENCHMARKS.spam_rate.critical ? 'border-destructive/50' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-warning" />
                    <span className="text-2xl font-bold">{overallStats.spamRate.toFixed(3)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Spam Complaint Rate</p>
                  <p className="text-xs text-muted-foreground mt-1">Max: &lt;{BENCHMARKS.spam_rate.critical}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold text-success">{overallStats.healthyAccounts}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Healthy Accounts</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ShieldX className="h-4 w-4 text-destructive" />
                    <span className="text-2xl font-bold text-destructive">{overallStats.criticalAccounts}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Critical Accounts</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="accounts" className="space-y-4">
              <TabsList>
                <TabsTrigger value="accounts">Email Accounts</TabsTrigger>
                <TabsTrigger value="domains">Domains</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>

              <TabsContent value="accounts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Email Account Health</CardTitle>
                    <CardDescription>
                      Monitor bounce rates, spam complaints, and overall health per mailbox
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email Account</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Sent</TableHead>
                          <TableHead className="text-right">Bounce Rate</TableHead>
                          <TableHead className="text-right">Spam Rate</TableHead>
                          <TableHead className="text-right">Reply Rate</TableHead>
                          <TableHead>Health Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emailAccounts.map(account => (
                          <TableRow key={account.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{account.email_address}</p>
                                {account.sender_name && (
                                  <p className="text-xs text-muted-foreground">{account.sender_name}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {account.is_active ? (
                                  <Badge variant="outline" className="text-success border-success/30">Active</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                                )}
                                {account.warmup_enabled && (
                                  <Badge variant="secondary" className="text-xs">Warmup</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">{account.sent_count.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono">{account.bounce_rate.toFixed(2)}%</span>
                                {getRateBadge(account.bounce_rate, 'bounce')}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono">{account.spam_rate.toFixed(3)}%</span>
                                {getRateBadge(account.spam_rate, 'spam')}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">{account.reply_rate.toFixed(2)}%</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={account.health_score} className="w-16 h-2" />
                                {getHealthBadge(account.health_score)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="domains" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Domain Health</CardTitle>
                    <CardDescription>
                      Authentication status and aggregate metrics per sending domain
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domain</TableHead>
                          <TableHead>SPF</TableHead>
                          <TableHead>DKIM</TableHead>
                          <TableHead>DMARC</TableHead>
                          <TableHead className="text-right">Accounts</TableHead>
                          <TableHead className="text-right">Sent</TableHead>
                          <TableHead className="text-right">Bounce Rate</TableHead>
                          <TableHead className="text-right">Spam Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {domains.map(domain => (
                          <TableRow key={domain.domain}>
                            <TableCell className="font-medium">{domain.domain}</TableCell>
                            <TableCell>{getAuthBadge(domain.spf_status)}</TableCell>
                            <TableCell>{getAuthBadge(domain.dkim_status)}</TableCell>
                            <TableCell>{getAuthBadge(domain.dmarc_status)}</TableCell>
                            <TableCell className="text-right font-mono">{domain.accounts_count}</TableCell>
                            <TableCell className="text-right font-mono">{domain.total_sent.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono">{domain.bounce_rate.toFixed(2)}%</span>
                                {getRateBadge(domain.bounce_rate, 'bounce')}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono">{domain.spam_rate.toFixed(3)}%</span>
                                {getRateBadge(domain.spam_rate, 'spam')}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Benchmark Reference */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Industry Benchmarks</CardTitle>
                    <CardDescription>Reference thresholds from cold email best practices</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="font-medium mb-2">Bounce Rate</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-success">Excellent</span>
                            <span>&lt; 2%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-warning">OK</span>
                            <span>&lt; 5%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-destructive">High</span>
                            <span>&gt; 5%</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="font-medium mb-2">Spam Complaint Rate</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-success">Safe</span>
                            <span>&lt; 0.1%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-warning">Warning</span>
                            <span>&lt; 0.3%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-destructive">Critical</span>
                            <span>&gt; 0.3%</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Google 2024 requirement: must stay below 0.3%</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="font-medium mb-2">Reply Rate</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-success">Excellent</span>
                            <span>&gt; 10%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-warning">Good</span>
                            <span>5-10%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Average</span>
                            <span>&lt; 5%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Bounce Rate Trend</CardTitle>
                      <CardDescription>Daily bounce rate over the last 30 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        {dailyTrends.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyTrends}>
                              <defs>
                                <linearGradient id="colorBounce" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis 
                                dataKey="date" 
                                stroke="hsl(var(--muted-foreground))" 
                                fontSize={12}
                                tickFormatter={(d) => format(parseISO(d), 'MMM d')}
                              />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Bounce Rate']}
                                labelFormatter={(label) => format(parseISO(label), 'PPP')}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="bounce_rate" 
                                stroke="hsl(var(--destructive))" 
                                fill="url(#colorBounce)" 
                                strokeWidth={2} 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            No trend data available
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Daily Volume</CardTitle>
                      <CardDescription>Emails sent, bounced, and spam complaints</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        {dailyTrends.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyTrends.slice(-14)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis 
                                dataKey="date" 
                                stroke="hsl(var(--muted-foreground))" 
                                fontSize={12}
                                tickFormatter={(d) => format(parseISO(d), 'MMM d')}
                              />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                                labelFormatter={(label) => format(parseISO(label), 'PPP')}
                              />
                              <Bar dataKey="sent" name="Sent" fill="hsl(var(--chart-1))" />
                              <Bar dataKey="bounced" name="Bounced" fill="hsl(var(--destructive))" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            No trend data available
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
