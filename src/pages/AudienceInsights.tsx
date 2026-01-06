import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, Building2, Briefcase, Mail, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface AudienceStats {
  email_type: string;
  total_leads: number;
  contacted: number;
  opened: number;
  replied: number;
  positive_replies: number;
  reply_rate: number;
  positive_reply_rate: number;
}

interface DomainStats {
  email_domain: string;
  total: number;
  replied: number;
  positive: number;
  reply_rate: number;
}

export default function AudienceInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [emailTypeStats, setEmailTypeStats] = useState<AudienceStats[]>([]);
  const [domainStats, setDomainStats] = useState<DomainStats[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchAudienceData();
    }
  }, [currentWorkspace?.id]);

  const fetchAudienceData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Get leads with their events for analysis
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, email, email_type, email_domain, company, title, industry')
        .eq('workspace_id', currentWorkspace.id);

      if (leadsError) throw leadsError;

      setTotalLeads(leads?.length || 0);

      // Get message events for these leads
      const { data: events, error: eventsError } = await supabase
        .from('message_events')
        .select('lead_id, event_type')
        .eq('workspace_id', currentWorkspace.id);

      if (eventsError) throw eventsError;

      // Aggregate by email type
      const emailTypeMap = new Map<string, AudienceStats>();
      
      (leads || []).forEach(lead => {
        const type = lead.email_type || 'unknown';
        if (!emailTypeMap.has(type)) {
          emailTypeMap.set(type, {
            email_type: type,
            total_leads: 0,
            contacted: 0,
            opened: 0,
            replied: 0,
            positive_replies: 0,
            reply_rate: 0,
            positive_reply_rate: 0,
          });
        }
        const stats = emailTypeMap.get(type)!;
        stats.total_leads++;

        const leadEvents = (events || []).filter(e => e.lead_id === lead.id);
        if (leadEvents.some(e => e.event_type === 'sent')) stats.contacted++;
        if (leadEvents.some(e => e.event_type === 'open')) stats.opened++;
        if (leadEvents.some(e => ['reply', 'positive_reply', 'negative_reply'].includes(e.event_type))) stats.replied++;
        if (leadEvents.some(e => e.event_type === 'positive_reply' || e.event_type === 'interested')) stats.positive_replies++;
      });

      emailTypeMap.forEach(stats => {
        stats.reply_rate = stats.contacted > 0 ? (stats.replied / stats.contacted) * 100 : 0;
        stats.positive_reply_rate = stats.contacted > 0 ? (stats.positive_replies / stats.contacted) * 100 : 0;
      });

      setEmailTypeStats(Array.from(emailTypeMap.values()));

      // Aggregate by domain
      const domainMap = new Map<string, DomainStats>();
      
      (leads || []).forEach(lead => {
        const domain = lead.email_domain || 'unknown';
        if (!domainMap.has(domain)) {
          domainMap.set(domain, {
            email_domain: domain,
            total: 0,
            replied: 0,
            positive: 0,
            reply_rate: 0,
          });
        }
        const stats = domainMap.get(domain)!;
        stats.total++;

        const leadEvents = (events || []).filter(e => e.lead_id === lead.id);
        if (leadEvents.some(e => ['reply', 'positive_reply', 'negative_reply'].includes(e.event_type))) stats.replied++;
        if (leadEvents.some(e => e.event_type === 'positive_reply' || e.event_type === 'interested')) stats.positive++;
      });

      domainMap.forEach(stats => {
        stats.reply_rate = stats.total > 0 ? (stats.replied / stats.total) * 100 : 0;
      });

      // Sort by total and take top 20
      const sortedDomains = Array.from(domainMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 20);

      setDomainStats(sortedDomains);
    } catch (err) {
      console.error('Error fetching audience data:', err);
    } finally {
      setLoading(false);
    }
  };

  const pieColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

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
            <h1 className="text-2xl font-bold tracking-tight">Audience Insights</h1>
            <p className="text-muted-foreground">Understand who responds to your campaigns</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : totalLeads === 0 ? (
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
            {/* Summary Cards */}
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
              {emailTypeStats.map(stat => (
                <Card key={stat.email_type}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {stat.email_type === 'work' ? (
                            <Building2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Mail className="h-4 w-4 text-chart-4" />
                          )}
                          <span className="text-2xl font-bold">{stat.total_leads.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{stat.email_type} Emails</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-success">{stat.positive_reply_rate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">positive</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Email Type Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personal vs Work Emails</CardTitle>
                  <CardDescription>Response rates by email type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={emailTypeStats}
                            dataKey="total_leads"
                            nameKey="email_type"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ email_type, total_leads }) => `${email_type}: ${total_leads}`}
                          >
                            {emailTypeStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                      {emailTypeStats.map(stat => (
                        <div key={stat.email_type} className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize">{stat.email_type}</span>
                            <Badge variant="outline">{stat.total_leads} leads</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Reply Rate</p>
                              <p className="font-mono">{stat.reply_rate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Positive Rate</p>
                              <p className="font-mono text-success">{stat.positive_reply_rate.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Domains */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Email Domains</CardTitle>
                  <CardDescription>Response rates by domain</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={domainStats.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="email_domain" type="category" fontSize={11} width={100} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="total" name="Total" fill="hsl(var(--chart-1))" />
                        <Bar dataKey="replied" name="Replied" fill="hsl(var(--chart-2))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Domain Details Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Domain Performance</CardTitle>
                <CardDescription>Detailed breakdown by email domain</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead className="text-right">Total Leads</TableHead>
                      <TableHead className="text-right">Replied</TableHead>
                      <TableHead className="text-right">Positive</TableHead>
                      <TableHead className="text-right">Reply Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domainStats.map(stat => (
                      <TableRow key={stat.email_domain}>
                        <TableCell className="font-medium">{stat.email_domain}</TableCell>
                        <TableCell className="text-right font-mono">{stat.total}</TableCell>
                        <TableCell className="text-right font-mono">{stat.replied}</TableCell>
                        <TableCell className="text-right font-mono text-success">{stat.positive}</TableCell>
                        <TableCell className="text-right font-mono">{stat.reply_rate.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
