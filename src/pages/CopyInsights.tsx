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
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  FileText, 
  TrendingUp, 
  Search, 
  ArrowUpDown,
  ExternalLink,
  Hash,
  AlignLeft,
  BarChart3,
  Lightbulb,
  Trophy,
  FlaskConical,
  CheckCircle,
  AlertCircle,
  Target,
} from 'lucide-react';
import { useCopyAnalytics, type SubjectLineAnalysis, type PatternAnalysis } from '@/hooks/useCopyAnalytics';
import { StatisticalConfidenceBadge, getConfidenceLevel } from '@/components/dashboard/StatisticalConfidenceBadge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';

type SortField = 'reply_rate' | 'open_rate' | 'positive_rate' | 'sent_count';
type SortOrder = 'asc' | 'desc';

export default function CopyInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { subjectLines, bodyCopy, patterns, topPerformers, recommendations, loading, error } = useCopyAnalytics();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('reply_rate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredSubjects = subjectLines
    .filter(s => 
      s.subject_line?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const filteredBody = bodyCopy
    .filter(b => 
      b.subject_line?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.body_preview?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField === 'open_rate' ? 'reply_rate' : sortField] || 0;
      const bVal = b[sortField === 'open_rate' ? 'reply_rate' : sortField] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

  const getPersonalizationBadge = (type: string) => {
    const colors: Record<string, string> = {
      company: 'bg-success/20 text-success border-success/30',
      trigger: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      first_name: 'bg-primary/20 text-primary border-primary/30',
      title: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
      industry: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      none: 'bg-muted text-muted-foreground border-border',
    };
    return <Badge className={`text-xs ${colors[type] || colors.none}`}>{type.replace('_', ' ')}</Badge>;
  };

  const getFormatBadge = (type: string) => {
    return <Badge variant="outline" className="text-xs">{type.replace('_', ' ')}</Badge>;
  };

  const getLengthBadge = (category: string, charCount: number) => {
    const colors: Record<string, string> = {
      short: 'bg-success/20 text-success border-success/30',
      very_short: 'bg-primary/20 text-primary border-primary/30',
      medium: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      long: 'bg-destructive/20 text-destructive border-destructive/30',
    };
    return (
      <Badge className={`text-xs ${colors[category] || ''}`}>
        {charCount} chars
      </Badge>
    );
  };

  const hasData = subjectLines.length > 0;

  // Pattern chart data
  const patternChartData = patterns
    .filter(p => p.significance !== 'low')
    .slice(0, 10)
    .map(p => ({
      name: p.pattern.length > 25 ? p.pattern.substring(0, 25) + '...' : p.pattern,
      reply_rate: p.avg_reply_rate,
      sample_size: p.sample_size,
    }));

  // Word count distribution for body copy
  const wordCountData = [
    { range: 'Under 50', count: bodyCopy.filter(b => b.word_count < 50).length, avgReply: 0 },
    { range: '50-100', count: bodyCopy.filter(b => b.word_count >= 50 && b.word_count < 100).length, avgReply: 0 },
    { range: '100-150', count: bodyCopy.filter(b => b.word_count >= 100 && b.word_count < 150).length, avgReply: 0 },
    { range: '150+', count: bodyCopy.filter(b => b.word_count >= 150).length, avgReply: 0 },
  ];

  bodyCopy.forEach(b => {
    let bucket;
    if (b.word_count < 50) bucket = wordCountData[0];
    else if (b.word_count < 100) bucket = wordCountData[1];
    else if (b.word_count < 150) bucket = wordCountData[2];
    else bucket = wordCountData[3];
    bucket.avgReply += b.reply_rate;
  });

  wordCountData.forEach(d => {
    d.avgReply = d.count > 0 ? d.avgReply / d.count : 0;
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
            <h1 className="text-2xl font-bold tracking-tight">Copy Insights</h1>
            <p className="text-muted-foreground">
              The Message Laboratory – Turn opinions into data
            </p>
          </div>
        </div>

        {!hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-chart-4/10 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-chart-4" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Copy Data Yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Sync your campaigns to analyze subject lines and body copy performance.
              </p>
              <Button asChild>
                <Link to="/connections">Go to Connections</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top Performers + Insights Row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Top Performers */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <CardTitle className="text-lg">Top Performers</CardTitle>
                  </div>
                  <CardDescription>Highest reply rate subject lines (min 100 sends)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topPerformers.slice(0, 5).map((item, index) => (
                    <div 
                      key={item.variant_id} 
                      className={`p-3 rounded-lg ${index === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-muted/50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-lg ${index === 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm line-clamp-1">{item.subject_line}</p>
                            <p className="text-xs text-muted-foreground">{item.campaign_name}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono text-sm font-medium text-success">{formatRate(item.reply_rate)}</p>
                          <p className="text-xs text-muted-foreground">{item.sent_count.toLocaleString()} sent</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {getPersonalizationBadge(item.personalization_type)}
                        {getFormatBadge(item.format_type)}
                        {getLengthBadge(item.length_category, item.char_count)}
                        <StatisticalConfidenceBadge sampleSize={item.sent_count} size="sm" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* AI Recommendations */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Insights</CardTitle>
                  </div>
                  <CardDescription>Data-driven recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recommendations.length > 0 ? (
                    recommendations.map((rec, i) => (
                      <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-sm">{rec}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Need more data to generate recommendations.</p>
                  )}
                  
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Suggested Test:</p>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium">A/B Test Hypothesis</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Test combining your top personalization pattern with question format to potentially improve reply rates.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pattern Analysis */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-chart-1" />
                  <CardTitle className="text-lg">Pattern Analysis</CardTitle>
                </div>
                <CardDescription>
                  What patterns correlate with higher reply rates? (Only showing patterns with statistical significance)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Pattern Chart */}
                  <div className="h-[300px]">
                    {patternChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={patternChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" fontSize={12} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                          <YAxis dataKey="name" type="category" fontSize={11} width={120} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Reply Rate']}
                          />
                          <Bar dataKey="reply_rate" fill="hsl(var(--chart-1))">
                            {patternChartData.map((entry, index) => (
                              <Cell 
                                key={index} 
                                fill={entry.reply_rate > 8 ? 'hsl(var(--success))' : 'hsl(var(--chart-1))'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Need more data for pattern analysis
                      </div>
                    )}
                  </div>

                  {/* Pattern Table */}
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pattern</TableHead>
                          <TableHead className="text-right">Avg Reply</TableHead>
                          <TableHead className="text-right">vs Baseline</TableHead>
                          <TableHead className="text-right">Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patterns.slice(0, 12).map((p, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{p.pattern}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatRate(p.avg_reply_rate)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={p.comparison_to_baseline > 0 ? 'text-success' : 'text-destructive'}>
                                {p.comparison_to_baseline > 0 ? '+' : ''}{p.comparison_to_baseline.toFixed(0)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  p.significance === 'high' ? 'bg-success/10 text-success border-success/30' :
                                  p.significance === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                                  ''
                                }`}
                              >
                                {p.significance}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for detailed analysis */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="subjects">
                  <Hash className="h-4 w-4 mr-2" />
                  Subject Lines
                </TabsTrigger>
                <TabsTrigger value="body">
                  <AlignLeft className="h-4 w-4 mr-2" />
                  Body Copy
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Word Count Impact */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Body Length Impact</CardTitle>
                      <CardDescription>Reply rate by word count</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={wordCountData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="range" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Avg Reply Rate']}
                            />
                            <Bar dataKey="avgReply" fill="hsl(var(--chart-2))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Research shows 50-100 words is the sweet spot for cold email.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Key Metrics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Quick Stats</CardTitle>
                      <CardDescription>Overall copy performance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Total Variants</p>
                          <p className="text-2xl font-bold">{subjectLines.length}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">High Confidence</p>
                          <p className="text-2xl font-bold text-success">
                            {subjectLines.filter(s => s.confidence_level === 'high').length}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Question format usage</span>
                          <span className="font-mono">
                            {((subjectLines.filter(s => s.format_type === 'question').length / subjectLines.length) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <Progress 
                          value={(subjectLines.filter(s => s.format_type === 'question').length / subjectLines.length) * 100} 
                          className="h-2"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Company personalization</span>
                          <span className="font-mono">
                            {((subjectLines.filter(s => s.personalization_type === 'company').length / subjectLines.length) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <Progress 
                          value={(subjectLines.filter(s => s.personalization_type === 'company').length / subjectLines.length) * 100} 
                          className="h-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="subjects" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Subject Line Performance</CardTitle>
                        <CardDescription>All subject lines with pattern analysis</CardDescription>
                      </div>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
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
                          <TableHead className="w-[30%]">Subject Line</TableHead>
                          <TableHead>Analysis</TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort('sent_count')}>
                              Sent <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort('open_rate')}>
                              Open Rate <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort('reply_rate')}>
                              Reply Rate <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubjects.slice(0, 50).map((item) => (
                          <TableRow key={item.variant_id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm line-clamp-1">{item.subject_line}</p>
                                <p className="text-xs text-muted-foreground">{item.campaign_name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {getPersonalizationBadge(item.personalization_type)}
                                {getFormatBadge(item.format_type)}
                                {getLengthBadge(item.length_category, item.char_count)}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{item.sent_count.toLocaleString()}</TableCell>
                            <TableCell className="font-mono text-sm">{formatRate(item.open_rate)}</TableCell>
                            <TableCell className="font-mono text-sm font-medium">{formatRate(item.reply_rate)}</TableCell>
                            <TableCell>
                              <StatisticalConfidenceBadge sampleSize={item.sent_count} size="sm" />
                            </TableCell>
                          </TableRow>
                        ))}
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
                        <CardDescription>Length, personalization depth, and CTA analysis</CardDescription>
                      </div>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
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
                          <TableHead className="w-[25%]">Email</TableHead>
                          <TableHead>Words</TableHead>
                          <TableHead>Personalization</TableHead>
                          <TableHead>CTA Type</TableHead>
                          <TableHead>Has Link</TableHead>
                          <TableHead>
                            <Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort('reply_rate')}>
                              Reply Rate <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBody.slice(0, 50).map((item) => (
                          <TableRow key={item.variant_id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm line-clamp-1">{item.subject_line}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{item.body_preview}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  item.word_count >= 50 && item.word_count <= 100 
                                    ? 'bg-success/10 text-success border-success/30' 
                                    : item.word_count > 150 
                                    ? 'bg-destructive/10 text-destructive border-destructive/30'
                                    : ''
                                }`}
                              >
                                {item.word_count}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  item.personalization_depth >= 3 
                                    ? 'bg-success/10 text-success border-success/30' 
                                    : item.personalization_depth === 0
                                    ? 'bg-muted text-muted-foreground'
                                    : ''
                                }`}
                              >
                                Level {item.personalization_depth}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {item.cta_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.has_link ? (
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-success" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm font-medium">
                              {formatRate(item.reply_rate)}
                            </TableCell>
                            <TableCell>
                              <StatisticalConfidenceBadge sampleSize={item.sent_count} size="sm" />
                            </TableCell>
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
