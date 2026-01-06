import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  FileText, 
  TrendingUp, 
  Search, 
  ArrowUpDown, 
  ExternalLink,
  MessageSquare,
  Hash,
  AtSign,
  BarChart3,
  AlignLeft,
  Sparkles,
} from 'lucide-react';
import { useCopyInsights, CopyPerformance } from '@/hooks/useCopyInsights';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  Legend,
} from 'recharts';

type SortField = 'reply_rate' | 'open_rate' | 'click_rate' | 'positive_rate' | 'sent_count' | 'word_count';
type SortOrder = 'asc' | 'desc';

interface BodyAnalytics {
  variant_id: string;
  campaign_name: string;
  variant_name: string;
  subject_line: string | null;
  body_preview: string | null;
  word_count: number;
  personalization_count: number;
  personalization_vars: string[];
  has_link: boolean;
  has_question: boolean;
  sent_count: number;
  reply_rate: number;
  positive_rate: number;
}

// Benchmarks from the guide
const BENCHMARKS = {
  word_count: { optimal_min: 50, optimal_max: 200 },
  personalization: { basic: 1, advanced: 3 },
};

export default function CopyInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useCopyInsights();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('reply_rate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [activeTab, setActiveTab] = useState('subjects');

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Process data for body analytics
  const bodyAnalytics: BodyAnalytics[] = data.map(item => {
    const body = item.body_preview || '';
    const personalizations = item.personalization_vars || [];
    
    return {
      variant_id: item.variant_id,
      campaign_name: item.campaign_name,
      variant_name: item.variant_name,
      subject_line: item.subject_line,
      body_preview: item.body_preview,
      word_count: item.word_count || body.split(/\s+/).filter(Boolean).length,
      personalization_count: personalizations.length,
      personalization_vars: personalizations,
      has_link: body.includes('http') || body.includes('www.'),
      has_question: body.includes('?'),
      sent_count: item.sent_count,
      reply_rate: item.reply_rate,
      positive_rate: item.positive_rate,
    };
  });

  const filteredData = data
    .filter(item => 
      item.subject_line?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.variant_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField as keyof CopyPerformance] as number || 0;
      const bVal = b[sortField as keyof CopyPerformance] as number || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const filteredBodyData = bodyAnalytics
    .filter(item => 
      item.subject_line?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.body_preview?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField as keyof BodyAnalytics] as number || 0;
      const bVal = b[sortField as keyof BodyAnalytics] as number || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const topPerformers = filteredData.filter(d => d.sent_count > 0).slice(0, 3);

  // Word count distribution for chart
  const wordCountBuckets = [
    { range: '0-50', count: 0, avgReplyRate: 0, total: 0 },
    { range: '51-100', count: 0, avgReplyRate: 0, total: 0 },
    { range: '101-150', count: 0, avgReplyRate: 0, total: 0 },
    { range: '151-200', count: 0, avgReplyRate: 0, total: 0 },
    { range: '200+', count: 0, avgReplyRate: 0, total: 0 },
  ];

  bodyAnalytics.forEach(item => {
    let bucket;
    if (item.word_count <= 50) bucket = wordCountBuckets[0];
    else if (item.word_count <= 100) bucket = wordCountBuckets[1];
    else if (item.word_count <= 150) bucket = wordCountBuckets[2];
    else if (item.word_count <= 200) bucket = wordCountBuckets[3];
    else bucket = wordCountBuckets[4];
    
    bucket.count++;
    bucket.total += item.reply_rate;
  });

  wordCountBuckets.forEach(bucket => {
    bucket.avgReplyRate = bucket.count > 0 ? bucket.total / bucket.count : 0;
  });

  // Personalization impact
  const personalizationImpact = [
    { level: 'None (0)', avgReplyRate: 0, count: 0, total: 0 },
    { level: 'Basic (1-2)', avgReplyRate: 0, count: 0, total: 0 },
    { level: 'Advanced (3+)', avgReplyRate: 0, count: 0, total: 0 },
  ];

  bodyAnalytics.forEach(item => {
    let bucket;
    if (item.personalization_count === 0) bucket = personalizationImpact[0];
    else if (item.personalization_count <= 2) bucket = personalizationImpact[1];
    else bucket = personalizationImpact[2];
    
    bucket.count++;
    bucket.total += item.reply_rate;
  });

  personalizationImpact.forEach(bucket => {
    bucket.avgReplyRate = bucket.count > 0 ? bucket.total / bucket.count : 0;
  });

  const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

  const getRateBadge = (rate: number, type: 'reply' | 'open' | 'click') => {
    const thresholds = {
      reply: { good: 3, great: 5 },
      open: { good: 30, great: 50 },
      click: { good: 2, great: 4 },
    };
    const t = thresholds[type];
    
    if (rate >= t.great) {
      return <Badge className="bg-success/20 text-success border-success/30">High</Badge>;
    } else if (rate >= t.good) {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Average</Badge>;
    }
    return null;
  };

  const getWordCountBadge = (count: number) => {
    if (count >= BENCHMARKS.word_count.optimal_min && count <= BENCHMARKS.word_count.optimal_max) {
      return <Badge className="bg-success/20 text-success border-success/30">Optimal</Badge>;
    }
    if (count < BENCHMARKS.word_count.optimal_min) {
      return <Badge variant="outline">Short</Badge>;
    }
    return <Badge className="bg-warning/20 text-warning border-warning/30">Long</Badge>;
  };

  const getPersonalizationBadge = (count: number) => {
    if (count >= BENCHMARKS.personalization.advanced) {
      return <Badge className="bg-success/20 text-success border-success/30">Advanced</Badge>;
    }
    if (count >= BENCHMARKS.personalization.basic) {
      return <Badge className="bg-primary/20 text-primary border-primary/30">Basic</Badge>;
    }
    return <Badge variant="outline">None</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const hasData = data.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Copy Insights</h1>
            <p className="text-muted-foreground">
              Analyze subject lines and email copy performance
            </p>
          </div>
          {!hasData && (
            <Button asChild>
              <Link to="/connections">
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect & Sync Data
              </Link>
            </Button>
          )}
        </div>

        {!hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-chart-4/10 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-chart-4" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Copy Data Yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Connect your Smartlead account and pull your campaign history to see 
                which subject lines and email copy drive the most replies.
              </p>
              <Button asChild>
                <Link to="/connections">Go to Connections</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top Performers */}
            {topPerformers.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {topPerformers.map((item, index) => (
                  <Card key={item.variant_id} className={index === 0 ? 'border-success/50' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1} Top Performer
                        </Badge>
                        {index === 0 && (
                          <TrendingUp className="h-4 w-4 text-success" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium text-sm line-clamp-2 mb-2">
                        {item.subject_line}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatRate(item.reply_rate)} reply</span>
                        <span>{formatRate(item.open_rate)} open</span>
                        <span>{item.sent_count.toLocaleString()} sent</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {item.campaign_name}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="subjects" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Subject Lines
                </TabsTrigger>
                <TabsTrigger value="body" className="flex items-center gap-2">
                  <AlignLeft className="h-4 w-4" />
                  Body Copy
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="subjects" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Subject Line Performance</CardTitle>
                        <CardDescription>
                          All subject lines ranked by performance metrics
                        </CardDescription>
                      </div>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search subject lines..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">Subject Line</TableHead>
                          <TableHead>Campaign</TableHead>
                          <TableHead>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-0 font-medium"
                              onClick={() => handleSort('sent_count')}
                            >
                              Sent
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-0 font-medium"
                              onClick={() => handleSort('open_rate')}
                            >
                              Open Rate
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-0 font-medium"
                              onClick={() => handleSort('reply_rate')}
                            >
                              Reply Rate
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No results found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredData.map((item) => (
                            <TableRow key={item.variant_id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium line-clamp-1">{item.subject_line}</p>
                                  <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {item.campaign_name}
                              </TableCell>
                              <TableCell>{item.sent_count.toLocaleString()}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {formatRate(item.open_rate)}
                                  {getRateBadge(item.open_rate, 'open')}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {formatRate(item.reply_rate)}
                                  {getRateBadge(item.reply_rate, 'reply')}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="body" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Body Copy Analysis</CardTitle>
                        <CardDescription>
                          Message length, personalization depth, and content patterns
                        </CardDescription>
                      </div>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search body copy..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[30%]">Email Variant</TableHead>
                          <TableHead>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-0 font-medium"
                              onClick={() => handleSort('word_count')}
                            >
                              Words
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead>Personalization</TableHead>
                          <TableHead>Content</TableHead>
                          <TableHead>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-0 font-medium"
                              onClick={() => handleSort('reply_rate')}
                            >
                              Reply Rate
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBodyData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No results found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredBodyData.map((item) => (
                            <TableRow key={item.variant_id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium line-clamp-1">{item.subject_line}</p>
                                  <p className="text-xs text-muted-foreground">{item.campaign_name}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">{item.word_count}</span>
                                  {getWordCountBadge(item.word_count)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">{item.personalization_count}</span>
                                  {getPersonalizationBadge(item.personalization_count)}
                                </div>
                                {item.personalization_vars.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.personalization_vars.slice(0, 3).map(v => (
                                      <Badge key={v} variant="secondary" className="text-xs">
                                        {`{{${v}}}`}
                                      </Badge>
                                    ))}
                                    {item.personalization_vars.length > 3 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{item.personalization_vars.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {item.has_question && (
                                    <Badge variant="outline" className="text-xs">
                                      <MessageSquare className="h-3 w-3 mr-1" />
                                      Question
                                    </Badge>
                                  )}
                                  {item.has_link && (
                                    <Badge variant="outline" className="text-xs text-warning border-warning/30">
                                      Link
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {formatRate(item.reply_rate)}
                                  {getRateBadge(item.reply_rate, 'reply')}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Reply Rate by Word Count</CardTitle>
                      <CardDescription>
                        Optimal length: {BENCHMARKS.word_count.optimal_min}-{BENCHMARKS.word_count.optimal_max} words
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={wordCountBuckets}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Avg Reply Rate']}
                            />
                            <Bar dataKey="avgReplyRate" name="Avg Reply Rate" fill="hsl(var(--primary))">
                              {wordCountBuckets.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={
                                    entry.range === '51-100' || entry.range === '101-150' || entry.range === '151-200'
                                      ? 'hsl(var(--success))'
                                      : 'hsl(var(--muted-foreground))'
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Personalization Impact</CardTitle>
                      <CardDescription>
                        Reply rate by personalization depth
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={personalizationImpact}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="level" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Avg Reply Rate']}
                            />
                            <Bar dataKey="avgReplyRate" name="Avg Reply Rate" fill="hsl(var(--chart-2))">
                              {personalizationImpact.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={
                                    index === 2 ? 'hsl(var(--success))' : 
                                    index === 1 ? 'hsl(var(--primary))' : 
                                    'hsl(var(--muted-foreground))'
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Best Practices Reference */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Copy Best Practices
                    </CardTitle>
                    <CardDescription>Industry benchmarks for cold email copy</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="font-medium mb-2">Message Length</p>
                        <p className="text-sm text-muted-foreground">
                          <strong>50-200 words</strong> performs best. Under 6-8 sentences keeps attention.
                          Longer emails see diminishing returns.
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="font-medium mb-2">Personalization</p>
                        <p className="text-sm text-muted-foreground">
                          <strong>3+ variables</strong> = advanced personalization.
                          Include name, company, and industry-specific pain points.
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="font-medium mb-2">Links</p>
                        <p className="text-sm text-muted-foreground">
                          Emails <strong>without links</strong> often get 2x better deliverability.
                          Save links for follow-ups.
                        </p>
                      </div>
                    </div>
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
