import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Search, 
  ArrowUpDown, 
  BookMarked, 
  Wand2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell, LineChart, Line } from 'recharts';
import type { SubjectLineAnalysis } from '@/hooks/useCopyAnalytics';
import { getPersonalizationLabel, getFormatLabel } from '@/lib/patternTaxonomy';
import { ExecutiveSummary } from '../ExecutiveSummary';
import { VariantDetailModal } from '../VariantDetailModal';

interface SubjectLinesTabProps {
  subjectLines: SubjectLineAnalysis[];
  baselineReplyRate: number;
  onSaveToLibrary: (item: SubjectLineAnalysis) => void;
}

export function SubjectLinesTab({ subjectLines, baselineReplyRate, onSaveToLibrary }: SubjectLinesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'reply_rate' | 'open_rate' | 'sent_count'>('reply_rate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedVariant, setSelectedVariant] = useState<SubjectLineAnalysis | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const handleViewDetails = useCallback((item: SubjectLineAnalysis) => {
    setSelectedVariant(item);
    setDetailModalOpen(true);
  }, []);

  // Format performance by type
  const formatPerformance = useMemo(() => {
    const groups: Record<string, { sent: number; replies: number; opens: number }> = {};
    
    subjectLines.forEach(s => {
      const format = s.format_type || 'statement';
      if (!groups[format]) groups[format] = { sent: 0, replies: 0, opens: 0 };
      groups[format].sent += s.sent_count;
      groups[format].replies += s.reply_count;
      groups[format].opens += s.open_count || 0;
    });

    const totalSent = Object.values(groups).reduce((sum, g) => sum + g.sent, 0);
    const totalOpens = Object.values(groups).reduce((sum, g) => sum + g.opens, 0);
    const baselineOpen = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;

    return Object.entries(groups)
      .map(([format, data]) => {
        const openRate = data.sent > 0 ? (data.opens / data.sent) * 100 : 0;
        return {
          format: getFormatLabel(format),
          sample_size: data.sent,
          open_rate: openRate,
          vs_baseline: baselineOpen > 0 ? ((openRate - baselineOpen) / baselineOpen) * 100 : 0,
          significance: data.sent > 100 ? (Math.abs(openRate - baselineOpen) > 3 ? 'significant' : 'not_significant') : 'low_sample',
        };
      })
      .sort((a, b) => b.open_rate - a.open_rate);
  }, [subjectLines]);

  // Length analysis
  const lengthBuckets = useMemo(() => {
    const buckets = [
      { range: '1-20', min: 1, max: 20, count: 0, sent: 0, opens: 0, replies: 0 },
      { range: '21-35', min: 21, max: 35, count: 0, sent: 0, opens: 0, replies: 0 },
      { range: '36-50', min: 36, max: 50, count: 0, sent: 0, opens: 0, replies: 0 },
      { range: '51-65', min: 51, max: 65, count: 0, sent: 0, opens: 0, replies: 0 },
      { range: '66-80', min: 66, max: 80, count: 0, sent: 0, opens: 0, replies: 0 },
      { range: '80+', min: 80, max: Infinity, count: 0, sent: 0, opens: 0, replies: 0 },
    ];

    subjectLines.forEach(s => {
      const charCount = s.char_count || s.subject_line?.length || 0;
      const bucket = buckets.find(b => charCount >= b.min && charCount < b.max);
      if (bucket) {
        bucket.count++;
        bucket.sent += s.sent_count;
        bucket.opens += s.open_count || 0;
        bucket.replies += s.reply_count;
      }
    });

    return buckets.map(b => ({
      ...b,
      open_rate: b.sent > 0 ? (b.opens / b.sent) * 100 : 0,
      reply_rate: b.sent > 0 ? (b.replies / b.sent) * 100 : 0,
    }));
  }, [subjectLines]);

  const bestLengthBucket = [...lengthBuckets].sort((a, b) => b.open_rate - a.open_rate)[0];

  // Personalization impact
  const personalizationImpact = useMemo(() => {
    const levels: Record<string, { sent: number; opens: number; replies: number }> = {
      'none': { sent: 0, opens: 0, replies: 0 },
      'first_name': { sent: 0, opens: 0, replies: 0 },
      'company': { sent: 0, opens: 0, replies: 0 },
      'name_company': { sent: 0, opens: 0, replies: 0 },
      'trigger': { sent: 0, opens: 0, replies: 0 },
    };

    subjectLines.forEach(s => {
      const type = s.personalization_type || 'none';
      if (!levels[type]) levels[type] = { sent: 0, opens: 0, replies: 0 };
      levels[type].sent += s.sent_count;
      levels[type].opens += s.open_count || 0;
      levels[type].replies += s.reply_count;
    });

    const baseSent = levels['none'].sent;
    const baseOpen = baseSent > 0 ? (levels['none'].opens / baseSent) * 100 : 0;
    const baseReply = baseSent > 0 ? (levels['none'].replies / baseSent) * 100 : 0;

    return Object.entries(levels)
      .filter(([_, data]) => data.sent > 0)
      .map(([level, data]) => {
        const openRate = data.sent > 0 ? (data.opens / data.sent) * 100 : 0;
        const replyRate = data.sent > 0 ? (data.replies / data.sent) * 100 : 0;
        return {
          level: getPersonalizationLabel(level),
          sample_size: data.sent,
          open_rate: openRate,
          reply_rate: replyRate,
          open_lift: baseOpen > 0 ? ((openRate - baseOpen) / baseOpen) * 100 : 0,
          reply_lift: baseReply > 0 ? ((replyRate - baseReply) / baseReply) * 100 : 0,
        };
      })
      .sort((a, b) => b.reply_rate - a.reply_rate);
  }, [subjectLines]);

  // Top and bottom performers
  const topPerformers = [...subjectLines]
    .filter(s => s.sent_count >= 100)
    .sort((a, b) => b.open_rate - a.open_rate)
    .slice(0, 5);

  const bottomPerformers = [...subjectLines]
    .filter(s => s.sent_count >= 100)
    .sort((a, b) => a.open_rate - b.open_rate)
    .slice(0, 3);

  // Filtered list
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

  const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

  // Generate executive summary insights
  const bestFormat = formatPerformance[0];
  const avgOpenRate = subjectLines.length > 0 
    ? subjectLines.reduce((sum, s) => sum + s.open_rate, 0) / subjectLines.length 
    : 0;

  const executiveInsights = [
    {
      type: bestFormat && bestFormat.vs_baseline > 10 ? 'positive' as const : 'neutral' as const,
      title: bestFormat ? `"${bestFormat.format}" subjects work best for you` : 'Testing different formats',
      description: bestFormat 
        ? `Subject lines with ${bestFormat.format.toLowerCase()} formatting get ${bestFormat.open_rate.toFixed(0)}% opens—that's ${bestFormat.vs_baseline > 0 ? '+' : ''}${bestFormat.vs_baseline.toFixed(0)}% vs your average.`
        : 'You need more data to identify winning formats.',
      impact: bestFormat ? `${bestFormat.open_rate.toFixed(0)}% opens` : undefined,
    },
    {
      type: bestLengthBucket && bestLengthBucket.open_rate > avgOpenRate ? 'positive' as const : 'neutral' as const,
      title: `Sweet spot: ${bestLengthBucket?.range || '21-35'} characters`,
      description: `Shorter subject lines fit better on mobile screens. Your best performers are ${bestLengthBucket?.range || '21-35'} characters.`,
      impact: `${bestLengthBucket?.open_rate.toFixed(0) || '38'}% opens`,
    },
    {
      type: personalizationImpact.length > 1 && personalizationImpact[0].reply_lift > 20 ? 'positive' as const : 'warning' as const,
      title: personalizationImpact[0]?.level === 'No Personalization' 
        ? 'Personalization could boost your results'
        : `${personalizationImpact[0]?.level || 'Personalized'} subjects perform best`,
      description: personalizationImpact[0]?.level === 'No Personalization'
        ? 'Most of your emails have no personalization. Adding names or company mentions typically lifts reply rates 20-40%.'
        : `When you use ${personalizationImpact[0]?.level?.toLowerCase() || 'personalization'}, you see ${personalizationImpact[0]?.reply_rate.toFixed(1)}% reply rates.`,
    },
  ];

  const bottomLine = bestFormat 
    ? `Use ${bestFormat.format.toLowerCase()} subject lines under ${bestLengthBucket?.range.split('-')[1] || '35'} characters with ${personalizationImpact[0]?.level?.toLowerCase() || 'personalization'} for best results.`
    : 'Keep testing different formats—you need more data to find your winning formula.';

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <ExecutiveSummary
        title="Subject Line Insights in Plain English"
        subtitle="What's making people open (or ignore) your emails"
        insights={executiveInsights}
        bottomLine={bottomLine}
      />

      {/* Subject Line Performance by Format */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Line Performance by Format</CardTitle>
          <CardDescription>Which subject line formats drive the best open rates?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formatPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 50]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="format" width={120} tick={{ fontSize: 12 }} />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{data.format}</p>
                        <p className="text-sm text-muted-foreground">Open Rate: {data.open_rate.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">Sample: {data.sample_size.toLocaleString()}</p>
                        <p className={`text-sm ${data.vs_baseline > 0 ? 'text-success' : 'text-destructive'}`}>
                          {data.vs_baseline > 0 ? '+' : ''}{data.vs_baseline.toFixed(0)}% vs baseline
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="open_rate" radius={[0, 4, 4, 0]}>
                  {formatPerformance.map((entry, index) => (
                    <Cell 
                      key={index} 
                      fill={entry.vs_baseline > 10 ? 'hsl(var(--success))' : 
                            entry.vs_baseline > 0 ? 'hsl(var(--success) / 0.7)' :
                            entry.vs_baseline > -10 ? 'hsl(var(--muted-foreground))' :
                            'hsl(var(--destructive))'}
                    />
                  ))}
                </Bar>
                <ReferenceLine x={formatPerformance.reduce((sum, f) => sum + f.open_rate, 0) / formatPerformance.length || 32} 
                  stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label="Avg" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Length Analysis + Personalization */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Length Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Subject Line Length Impact</CardTitle>
            <CardDescription>Shorter subjects perform better on mobile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lengthBuckets}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 50]} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="open_rate" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
              <strong>📊 INSIGHT:</strong> Subject lines between {bestLengthBucket?.range || '21-35'} characters 
              perform best ({bestLengthBucket?.open_rate.toFixed(1) || 37.8}% open rate)
            </div>
          </CardContent>
        </Card>

        {/* Personalization Impact */}
        <Card>
          <CardHeader>
            <CardTitle>Personalization Impact</CardTitle>
            <CardDescription>How personalization affects performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {personalizationImpact.map((level, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-32 truncate">{level.level}</div>
                  <div className="w-16 text-muted-foreground">{level.sample_size.toLocaleString()}</div>
                  <div className="flex-1 relative h-4 bg-muted rounded">
                    <div 
                      className="absolute h-full rounded bg-primary"
                      style={{ width: `${Math.min((level.reply_rate / 8) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="w-14 font-medium">{level.reply_rate.toFixed(1)}%</div>
                  <div className={`w-16 text-xs ${level.reply_lift > 0 ? 'text-success' : level.reply_lift < 0 ? 'text-destructive' : ''}`}>
                    {level.reply_lift > 0 ? '+' : ''}{level.reply_lift.toFixed(0)}% reply
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top & Bottom Performers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Top & Bottom Performing Subject Lines</CardTitle>
              <CardDescription>Minimum 100 sends for statistical relevance</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search subjects..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Performers */}
            <div>
              <h4 className="text-sm font-medium text-success mb-3 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> TOP PERFORMING
              </h4>
              <div className="space-y-2">
                {topPerformers.map((item, i) => (
                  <div key={item.variant_id} className={`p-3 rounded-lg ${i === 0 ? 'bg-success/10 border border-success/30' : 'bg-muted/50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg text-success">#{i + 1}</span>
                          <p className="text-sm font-medium truncate">{item.subject_line}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.campaign_name}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">{getFormatLabel(item.format_type)}</Badge>
                          <Badge variant="outline" className="text-xs">{getPersonalizationLabel(item.personalization_type)}</Badge>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-mono text-sm font-medium">{formatRate(item.open_rate)}</div>
                        <div className="text-xs text-muted-foreground">n={item.sent_count.toLocaleString()}</div>
                      </div>
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetails(item)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Details</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSaveToLibrary(item)}>
                                <BookMarked className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Save to Library</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Performers */}
            <div>
              <h4 className="text-sm font-medium text-destructive mb-3 flex items-center gap-1">
                <TrendingDown className="h-4 w-4" /> NEEDS IMPROVEMENT
              </h4>
              <div className="space-y-2">
                {bottomPerformers.map((item, i) => (
                  <div key={item.variant_id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.subject_line}</p>
                        <p className="text-xs text-muted-foreground">{item.campaign_name}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          Generic, no personalization
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-mono text-sm font-medium text-destructive">{formatRate(item.open_rate)}</div>
                        <div className="text-xs text-muted-foreground">n={item.sent_count.toLocaleString()}</div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        <Wand2 className="h-3 w-3 mr-1" /> Improve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variant Detail Modal */}
      <VariantDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        variant={selectedVariant ? {
          variant_id: selectedVariant.variant_id,
          campaign_name: selectedVariant.campaign_name,
          subject_line: selectedVariant.subject_line,
          sent_count: selectedVariant.sent_count,
          open_count: selectedVariant.open_count,
          reply_count: selectedVariant.reply_count,
          positive_count: selectedVariant.positive_count,
          open_rate: selectedVariant.open_rate,
          reply_rate: selectedVariant.reply_rate,
          positive_rate: selectedVariant.positive_rate,
          format_type: selectedVariant.format_type,
          personalization_type: selectedVariant.personalization_type,
          char_count: selectedVariant.char_count,
          word_count: selectedVariant.word_count,
        } : null}
        baselineReplyRate={baselineReplyRate}
        onSaveToLibrary={selectedVariant ? () => {
          onSaveToLibrary(selectedVariant);
          setDetailModalOpen(false);
        } : undefined}
      />
    </div>
  );
}
