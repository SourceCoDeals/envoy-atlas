import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
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
  Hash,
  AlignLeft,
  BarChart3,
  Trophy,
  FlaskConical,
  CheckCircle,
  RefreshCw,
  Sparkles,
  Wand2,
  Lightbulb,
  AlertCircle,
  BookMarked,
} from 'lucide-react';
import { SaveToLibraryDialog } from '@/components/copylibrary/SaveToLibraryDialog';
import { useCopyAnalytics, type SubjectLineAnalysis, type BodyCopyAnalysis } from '@/hooks/useCopyAnalytics';
import { StatisticalConfidenceBadge } from '@/components/dashboard/StatisticalConfidenceBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AIRecommendationsPanel } from '@/components/copyinsights/AIRecommendationsPanel';
import { VariantSuggestionModal } from '@/components/copyinsights/VariantSuggestionModal';

type SortField = 'reply_rate' | 'open_rate' | 'positive_rate' | 'sent_count';
type SortOrder = 'asc' | 'desc';

export default function CopyInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { subjectLines, bodyCopy, patterns, discoveredPatterns, topPerformers, recommendations, loading, error } = useCopyAnalytics();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('reply_rate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [activeTab, setActiveTab] = useState('overview');
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<{
    id: string;
    subject_line: string;
    body_preview: string;
    campaign_name: string;
    reply_rate: number;
    sent_count: number;
  } | null>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveVariantData, setSaveVariantData] = useState<{
    subject_line: string;
    body_preview?: string | null;
    source_variant_id?: string | null;
    performance?: {
      sent_count?: number;
      reply_rate?: number;
      positive_rate?: number;
    };
  } | null>(null);

  const handleSaveToLibrary = (item: SubjectLineAnalysis) => {
    // Find matching body copy for this variant
    const bodyData = bodyCopy.find(b => b.variant_id === item.variant_id);
    setSaveVariantData({
      subject_line: item.subject_line,
      body_preview: bodyData?.body_preview || null,
      source_variant_id: item.variant_id,
      performance: {
        sent_count: item.sent_count,
        reply_rate: item.reply_rate / 100,
        positive_rate: item.positive_rate / 100,
      },
    });
    setSaveDialogOpen(true);
  };

  const handleBackfillAndRecompute = useCallback(async () => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return;
    }

    setIsBackfilling(true);
    toast.info('Starting feature backfill...');

    try {
      // Step 1: Backfill features
      let backfillComplete = false;
      let totalBackfilled = 0;
      
      while (!backfillComplete) {
        const { data: backfillResult, error: backfillError } = await supabase.functions.invoke('backfill-features', {
          body: { workspace_id: currentWorkspace.id, batch_size: 100 },
        });

        if (backfillError) throw backfillError;
        
        totalBackfilled += backfillResult.backfilled || 0;
        backfillComplete = (backfillResult.remaining || 0) === 0;
        
        if (!backfillComplete) {
          toast.info(`Backfilled ${totalBackfilled} variants, ${backfillResult.remaining} remaining...`);
        }
      }

      toast.success(`Feature backfill complete! Processed ${totalBackfilled} variants`);
      setIsBackfilling(false);
      
      // Step 2: Recompute patterns
      setIsRecomputing(true);
      toast.info('Computing patterns...');

      const { data: patternResult, error: patternError } = await supabase.functions.invoke('compute-patterns', {
        body: { workspace_id: currentWorkspace.id },
      });

      if (patternError) throw patternError;

      toast.success(`Pattern analysis complete! Found ${patternResult.patterns_computed} patterns (${patternResult.validated_patterns} validated)`);
      
      // Refresh the page data
      window.location.reload();
    } catch (err: any) {
      console.error('Recompute error:', err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsBackfilling(false);
      setIsRecomputing(false);
    }
  }, [currentWorkspace?.id]);

  const handleRecomputePatterns = useCallback(async () => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return;
    }

    setIsRecomputing(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('compute-patterns', {
        body: { workspace_id: currentWorkspace.id },
      });

      if (fnError) throw fnError;

      toast.success(`Computed ${data.patterns_computed} patterns (${data.validated_patterns} statistically validated)`);
      window.location.reload();
    } catch (err: any) {
      console.error('Pattern computation error:', err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsRecomputing(false);
    }
  }, [currentWorkspace?.id]);

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
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleBackfillAndRecompute}
                    disabled={isBackfilling || isRecomputing}
                  >
                    {isBackfilling ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Backfilling...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" /> Backfill & Analyze</>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Extract features for all variants and recompute patterns</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRecomputePatterns}
                    disabled={isRecomputing || isBackfilling}
                  >
                    {isRecomputing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Computing...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" /> Recompute Patterns</>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recalculate pattern analysis with current data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
                        <div className="flex items-center gap-3">
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono text-sm font-medium text-success">{formatRate(item.reply_rate)}</p>
                            <p className="text-xs text-muted-foreground">{item.sent_count.toLocaleString()} sent</p>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleSaveToLibrary(item)}
                                >
                                  <BookMarked className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Save to Copy Library</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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

              {/* AI Recommendations Panel */}
              <AIRecommendationsPanel 
                workspaceId={currentWorkspace?.id} 
                hasData={hasData} 
              />
            </div>

            {/* Pattern Discovery */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-chart-1" />
                    <CardTitle className="text-lg">Pattern Discovery</CardTitle>
                  </div>
                  {discoveredPatterns.some(p => p.is_validated) && (
                    <Badge className="bg-success/10 text-success border-success/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {discoveredPatterns.filter(p => p.is_validated).length} Validated
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Statistically significant patterns correlated with higher reply rates
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
                          <RechartsTooltip
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

                  {/* Pattern Table with Enhanced Confidence */}
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pattern</TableHead>
                          <TableHead className="text-right">Reply Rate</TableHead>
                          <TableHead className="text-right">Lift</TableHead>
                          <TableHead className="text-right">Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patterns.slice(0, 12).map((p, i) => (
                          <TableRow key={i} className={p.is_validated ? 'bg-success/5' : ''}>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2">
                                {p.is_validated && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <CheckCircle className="h-3.5 w-3.5 text-success flex-shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Statistically validated pattern</p>
                                        {p.p_value && <p className="text-xs">p-value: {p.p_value.toFixed(4)}</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <span>{p.pattern}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="font-mono text-sm">
                                    {formatRate(p.avg_reply_rate)}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">Sample: {p.sample_size.toLocaleString()}</p>
                                    {p.confidence_interval_lower && p.confidence_interval_upper && (
                                      <p className="text-xs text-muted-foreground">
                                        95% CI: {p.confidence_interval_lower.toFixed(1)}% - {p.confidence_interval_upper.toFixed(1)}%
                                      </p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={p.comparison_to_baseline > 0 ? 'text-success font-medium' : 'text-destructive'}>
                                {p.comparison_to_baseline > 0 ? '+' : ''}{p.comparison_to_baseline.toFixed(0)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <StatisticalConfidenceBadge sampleSize={p.sample_size} size="sm" showTooltip />
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
                            <RechartsTooltip
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
                          <TableHead className="w-[60px]"></TableHead>
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
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        setSelectedVariant({
                                          id: item.variant_id,
                                          subject_line: item.subject_line,
                                          body_preview: '',
                                          campaign_name: item.campaign_name,
                                          reply_rate: item.reply_rate,
                                          sent_count: item.sent_count,
                                        });
                                        setIsVariantModalOpen(true);
                                      }}
                                    >
                                      <Wand2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Get AI suggestions</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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

      {/* Variant Suggestion Modal */}
      <VariantSuggestionModal
        open={isVariantModalOpen}
        onOpenChange={setIsVariantModalOpen}
        variant={selectedVariant}
        workspaceId={currentWorkspace?.id}
      />

      {/* Save to Library Dialog */}
      <SaveToLibraryDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        variantData={saveVariantData}
      />
    </DashboardLayout>
  );
}
