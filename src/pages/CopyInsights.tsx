import { useEffect, useState, useCallback, useMemo } from 'react';
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
  GitCompare,
  Target,
  Ruler,
  Users,
  MessageSquareText,
} from 'lucide-react';
import { SaveToLibraryDialog } from '@/components/copylibrary/SaveToLibraryDialog';
import { useCopyAnalytics, type SubjectLineAnalysis, type BodyCopyAnalysis } from '@/hooks/useCopyAnalytics';
import { StatisticalConfidenceBadge, calculateConfidenceInterval, getConfidenceLevel } from '@/components/dashboard/StatisticalConfidenceBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  getPersonalizationLabel, 
  getFormatLabel, 
  PERSONALIZATION_DESCRIPTIONS,
  FORMAT_DESCRIPTIONS,
} from '@/lib/patternTaxonomy';
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
import { CTAAnalysisSection } from '@/components/copyinsights/CTAAnalysisSection';
import { LengthImpactSection } from '@/components/copyinsights/LengthImpactSection';
import { CopyDecaySection } from '@/components/copyinsights/CopyDecaySection';
import { CopyComparisonDialog } from '@/components/copyinsights/CopyComparisonDialog';
import { CopyPerformanceSummary } from '@/components/copyinsights/CopyPerformanceSummary';
import { SegmentCopyMatrix } from '@/components/copyinsights/SegmentCopyMatrix';
import { OpeningLineAnalysis } from '@/components/copyinsights/OpeningLineAnalysis';
import { SubjectLineDeepDive } from '@/components/copyinsights/SubjectLineDeepDive';
import { BodyCopyDeepDive } from '@/components/copyinsights/BodyCopyDeepDive';
import { ChatPanel } from '@/components/copyinsights/ChatPanel';
import { 
  detectOpeningType, 
  detectFirstWordType, 
  detectCapitalizationStyle,
  detectPunctuationType,
  calculateYouIRatio,
} from '@/lib/patternTaxonomy';

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
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
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
  const [decayingVariants, setDecayingVariants] = useState<any[]>([]);
  const [ctaMetrics, setCtaMetrics] = useState<any[]>([]);
  const [segmentCopyInteractions, setSegmentCopyInteractions] = useState<any[]>([]);

  // Fetch decay tracking data
  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchDecayData();
      fetchCTAMetrics();
      fetchSegmentCopyData();
    }
  }, [currentWorkspace?.id]);

  const fetchDecayData = async () => {
    if (!currentWorkspace?.id) return;
    
    const { data, error } = await supabase
      .from('variant_decay_tracking')
      .select(`
        *,
        campaign_variants!inner (
          subject_line,
          campaigns!inner (
            name
          )
        )
      `)
      .eq('workspace_id', currentWorkspace.id)
      .eq('is_decaying', true)
      .order('decay_percentage', { ascending: true });
    
    if (data && !error) {
      setDecayingVariants(data.map(d => ({
        variant_id: d.variant_id,
        subject_line: (d.campaign_variants as any)?.subject_line || 'Unknown',
        campaign_name: (d.campaign_variants as any)?.campaigns?.name || 'Unknown',
        initial_reply_rate: d.initial_reply_rate || 0,
        current_reply_rate: d.current_reply_rate || 0,
        decay_percentage: d.decay_percentage || 0,
        total_sends: d.total_sends || 0,
        weekly_data: [], // Would need time-series data
        decay_severity: d.decay_severity || 'mild',
        diagnosis: d.decay_diagnosis,
        recommendation: d.decay_severity === 'severe' 
          ? 'Consider pausing this variant and creating a replacement with fresh copy.'
          : 'Monitor closely and prepare backup variants.',
      })));
    }
  };

  const fetchCTAMetrics = async () => {
    // Calculate CTA metrics from body copy data
    if (bodyCopy.length === 0) return;
    
    const ctaGroups: Record<string, { sent: number; replies: number; positive: number }> = {};
    
    bodyCopy.forEach(b => {
      if (!ctaGroups[b.cta_type]) {
        ctaGroups[b.cta_type] = { sent: 0, replies: 0, positive: 0 };
      }
      ctaGroups[b.cta_type].sent += b.sent_count;
      ctaGroups[b.cta_type].replies += b.reply_count;
      ctaGroups[b.cta_type].positive += b.positive_count;
    });
    
    const totalSent = Object.values(ctaGroups).reduce((sum, g) => sum + g.sent, 0);
    const totalReplies = Object.values(ctaGroups).reduce((sum, g) => sum + g.replies, 0);
    const baselineReply = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;
    
    const metrics = Object.entries(ctaGroups).map(([cta, data]) => {
      const replyRate = data.sent > 0 ? (data.replies / data.sent) * 100 : 0;
      const positiveRate = data.sent > 0 ? (data.positive / data.sent) * 100 : 0;
      return {
        cta_type: cta,
        reply_rate: replyRate,
        positive_rate: positiveRate,
        meeting_rate: 0,
        sample_size: data.sent,
        lift_vs_baseline: baselineReply > 0 ? ((replyRate - baselineReply) / baselineReply) * 100 : 0,
      };
    });
    
    setCtaMetrics(metrics);
  };

  const fetchSegmentCopyData = async () => {
    // Query real segment × copy interactions from audience_performance view + copy patterns
    if (!currentWorkspace?.id) return;
    
    try {
      // Fetch audience performance data which includes title, industry, seniority
      const { data: audienceData, error: audienceError } = await supabase
        .from('audience_performance')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (audienceError) {
        console.warn('Audience performance query failed:', audienceError);
        setSegmentCopyInteractions([]);
        return;
      }

      // If no audience data with seniority/title, show empty state
      const filteredData = (audienceData || []).filter(d => d.title || d.industry);
      
      if (filteredData.length === 0) {
        console.log('No enriched audience data available for segment analysis');
        setSegmentCopyInteractions([]);
        return;
      }

      // Transform audience data into segment × copy interactions
      // This is a simplified version - real implementation would join with variant-level data
      const interactions: any[] = filteredData.slice(0, 20).map(d => ({
        segment: d.title || d.industry || 'Unknown',
        segment_type: d.title ? 'seniority' : 'industry',
        pattern: 'All Copy',
        pattern_type: 'baseline',
        reply_rate: d.reply_rate || 0,
        segment_avg_reply_rate: d.reply_rate || 0,
        pattern_avg_reply_rate: 0,
        sample_size: d.total_leads || 0,
        lift_vs_segment: 0,
        lift_vs_pattern: 0,
        is_significant: (d.total_leads || 0) > 100,
      }));

      setSegmentCopyInteractions(interactions);
    } catch (err) {
      console.error('Error fetching segment copy data:', err);
      setSegmentCopyInteractions([]);
    }
  };

  // Re-fetch CTA metrics when body copy loads
  useEffect(() => {
    if (bodyCopy.length > 0) {
      fetchCTAMetrics();
    }
  }, [bodyCopy]);

  // Re-fetch segment data when patterns load
  useEffect(() => {
    if (patterns.length > 0) {
      fetchSegmentCopyData();
    }
  }, [patterns]);

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
    const label = getPersonalizationLabel(type);
    const description = PERSONALIZATION_DESCRIPTIONS[type];
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`text-xs cursor-help ${colors[type] || colors.none}`}>{label}</Badge>
          </TooltipTrigger>
          {description && (
            <TooltipContent>
              <p className="text-xs">{description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  const getFormatBadge = (type: string) => {
    const label = getFormatLabel(type);
    const description = FORMAT_DESCRIPTIONS[type];
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs cursor-help">{label}</Badge>
          </TooltipTrigger>
          {description && (
            <TooltipContent>
              <p className="text-xs">{description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
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

  // Calculate baseline reply rate for pattern comparison
  const baselineReplyRate = useMemo(() => {
    const totalSent = subjectLines.reduce((sum, s) => sum + s.sent_count, 0);
    const totalReplies = subjectLines.reduce((sum, s) => sum + s.reply_count, 0);
    return totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;
  }, [subjectLines]);

  // Pattern chart data with baseline
  const patternChartData = patterns
    .filter(p => p.significance !== 'low')
    .slice(0, 10)
    .map(p => ({
      name: p.pattern.length > 25 ? p.pattern.substring(0, 25) + '...' : p.pattern,
      reply_rate: p.avg_reply_rate,
      sample_size: p.sample_size,
      baseline: baselineReplyRate,
      lift: p.comparison_to_baseline,
    }));

  // Word count distribution for body copy with sample sizes
  const wordCountData = useMemo(() => {
    const buckets = [
      { range: 'Under 50', min: 0, max: 50, count: 0, totalSent: 0, totalReplies: 0, avgReply: 0 },
      { range: '50-100', min: 50, max: 100, count: 0, totalSent: 0, totalReplies: 0, avgReply: 0 },
      { range: '100-150', min: 100, max: 150, count: 0, totalSent: 0, totalReplies: 0, avgReply: 0 },
      { range: '150+', min: 150, max: Infinity, count: 0, totalSent: 0, totalReplies: 0, avgReply: 0 },
    ];
    
    bodyCopy.forEach(b => {
      const bucket = buckets.find(bkt => b.word_count >= bkt.min && b.word_count < bkt.max);
      if (bucket) {
        bucket.count++;
        bucket.totalSent += b.sent_count;
        bucket.totalReplies += b.reply_count;
      }
    });
    
    buckets.forEach(d => {
      d.avgReply = d.totalSent > 0 ? (d.totalReplies / d.totalSent) * 100 : 0;
    });
    
    return buckets;
  }, [bodyCopy]);

  // Find best performing word count bucket
  const bestWordCountBucket = useMemo(() => {
    return [...wordCountData].sort((a, b) => b.avgReply - a.avgReply)[0];
  }, [wordCountData]);

  // Opening line metrics computed from body copy
  const openingMetrics = useMemo(() => {
    const openingGroups: Record<string, { sent: number; replies: number; positive: number }> = {};
    
    bodyCopy.forEach(b => {
      // Detect opening type from body_preview or email_body
      const bodyText = b.email_body || b.body_preview || '';
      const openingType = detectOpeningType(bodyText);
      
      if (!openingGroups[openingType]) {
        openingGroups[openingType] = { sent: 0, replies: 0, positive: 0 };
      }
      openingGroups[openingType].sent += b.sent_count;
      openingGroups[openingType].replies += b.reply_count;
      openingGroups[openingType].positive += b.positive_count;
    });

    const totalSent = Object.values(openingGroups).reduce((sum, g) => sum + g.sent, 0);
    const totalReplies = Object.values(openingGroups).reduce((sum, g) => sum + g.replies, 0);
    const baselineReply = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;

    return Object.entries(openingGroups).map(([opening, data]) => {
      const replyRate = data.sent > 0 ? (data.replies / data.sent) * 100 : 0;
      const positiveRate = data.sent > 0 ? (data.positive / data.sent) * 100 : 0;
      return {
        opening_type: opening,
        reply_rate: replyRate,
        positive_rate: positiveRate,
        sample_size: data.sent,
        lift_vs_baseline: baselineReply > 0 ? ((replyRate - baselineReply) / baselineReply) * 100 : 0,
      };
    }).sort((a, b) => b.reply_rate - a.reply_rate);
  }, [bodyCopy]);

  // Personalization depth data computed from body copy
  const personalizationDepthData = useMemo(() => {
    const depthGroups: Record<string, { sent: number; replies: number }> = {
      'None': { sent: 0, replies: 0 },
      'Light (1-2 vars)': { sent: 0, replies: 0 },
      'Medium (3-4 vars)': { sent: 0, replies: 0 },
      'Heavy (5+ vars)': { sent: 0, replies: 0 },
    };

    bodyCopy.forEach(b => {
      let key = 'None';
      if (b.personalization_depth === 0) key = 'None';
      else if (b.personalization_depth <= 2) key = 'Light (1-2 vars)';
      else if (b.personalization_depth <= 4) key = 'Medium (3-4 vars)';
      else key = 'Heavy (5+ vars)';
      
      depthGroups[key].sent += b.sent_count;
      depthGroups[key].replies += b.reply_count;
    });

    return Object.entries(depthGroups)
      .filter(([_, d]) => d.sent > 0)
      .map(([depth, data]) => ({
        depth,
        reply_rate: data.sent > 0 ? (data.replies / data.sent) * 100 : 0,
        sample_size: data.sent,
      }));
  }, [bodyCopy]);

  // You:I ratio data computed from body copy
  const youIRatioData = useMemo(() => {
    const ratioGroups: Record<string, { sent: number; replies: number }> = {
      'Low (<1:1)': { sent: 0, replies: 0 },
      'Balanced (1-2:1)': { sent: 0, replies: 0 },
      'High (2-3:1)': { sent: 0, replies: 0 },
      'Very High (3+:1)': { sent: 0, replies: 0 },
    };

    bodyCopy.forEach(b => {
      const bodyText = b.email_body || b.body_preview || '';
      const ratio = calculateYouIRatio(bodyText);
      
      let key = 'Low (<1:1)';
      if (ratio < 1) key = 'Low (<1:1)';
      else if (ratio < 2) key = 'Balanced (1-2:1)';
      else if (ratio < 3) key = 'High (2-3:1)';
      else key = 'Very High (3+:1)';

      ratioGroups[key].sent += b.sent_count;
      ratioGroups[key].replies += b.reply_count;
    });

    return Object.entries(ratioGroups)
      .filter(([_, d]) => d.sent > 0)
      .map(([ratio_bucket, data]) => ({
        ratio_bucket,
        reply_rate: data.sent > 0 ? (data.replies / data.sent) * 100 : 0,
        sample_size: data.sent,
      }));
  }, [bodyCopy]);

  // First word analysis data computed from subject lines
  const firstWordData = useMemo(() => {
    const groups: Record<string, { sent: number; replies: number }> = {};

    subjectLines.forEach(s => {
      const firstWordType = detectFirstWordType(s.subject_line);
      if (!groups[firstWordType]) {
        groups[firstWordType] = { sent: 0, replies: 0 };
      }
      groups[firstWordType].sent += s.sent_count;
      groups[firstWordType].replies += s.reply_count;
    });

    const totalSent = Object.values(groups).reduce((sum, g) => sum + g.sent, 0);
    const totalReplies = Object.values(groups).reduce((sum, g) => sum + g.replies, 0);
    const baseline = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;

    return Object.entries(groups).map(([pattern, data]) => {
      const replyRate = data.sent > 0 ? (data.replies / data.sent) * 100 : 0;
      return {
        pattern,
        pattern_type: 'first_word',
        reply_rate: replyRate,
        sample_size: data.sent,
        lift_vs_baseline: baseline > 0 ? ((replyRate - baseline) / baseline) * 100 : 0,
      };
    }).sort((a, b) => b.reply_rate - a.reply_rate);
  }, [subjectLines]);

  // Capitalization style analysis
  const capitalizationData = useMemo(() => {
    const groups: Record<string, { sent: number; replies: number }> = {};

    subjectLines.forEach(s => {
      const capStyle = detectCapitalizationStyle(s.subject_line);
      if (!groups[capStyle]) {
        groups[capStyle] = { sent: 0, replies: 0 };
      }
      groups[capStyle].sent += s.sent_count;
      groups[capStyle].replies += s.reply_count;
    });

    return Object.entries(groups).map(([pattern, data]) => ({
      pattern,
      pattern_type: 'capitalization',
      reply_rate: data.sent > 0 ? (data.replies / data.sent) * 100 : 0,
      sample_size: data.sent,
      lift_vs_baseline: 0,
    })).sort((a, b) => b.reply_rate - a.reply_rate);
  }, [subjectLines]);

  // Punctuation analysis
  const punctuationData = useMemo(() => {
    const groups: Record<string, { sent: number; replies: number }> = {};

    subjectLines.forEach(s => {
      const punctTypes = detectPunctuationType(s.subject_line);
      // Each subject can have multiple punctuation types
      punctTypes.forEach(punctType => {
        if (!groups[punctType]) {
          groups[punctType] = { sent: 0, replies: 0 };
        }
        groups[punctType].sent += s.sent_count;
        groups[punctType].replies += s.reply_count;
      });
    });

    return Object.entries(groups).map(([pattern, data]) => ({
      pattern,
      pattern_type: 'punctuation',
      reply_rate: data.sent > 0 ? (data.replies / data.sent) * 100 : 0,
      sample_size: data.sent,
      lift_vs_baseline: 0,
    })).sort((a, b) => b.reply_rate - a.reply_rate);
  }, [subjectLines]);

  // Number presence analysis
  const numberPresenceData = useMemo(() => {
    const withNumber = { sent: 0, replies: 0 };
    const withoutNumber = { sent: 0, replies: 0 };

    subjectLines.forEach(s => {
      if (s.has_number) {
        withNumber.sent += s.sent_count;
        withNumber.replies += s.reply_count;
      } else {
        withoutNumber.sent += s.sent_count;
        withoutNumber.replies += s.reply_count;
      }
    });

    return [
      { 
        has_number: true, 
        reply_rate: withNumber.sent > 0 ? (withNumber.replies / withNumber.sent) * 100 : 0,
        sample_size: withNumber.sent
      },
      { 
        has_number: false, 
        reply_rate: withoutNumber.sent > 0 ? (withoutNumber.replies / withoutNumber.sent) * 100 : 0,
        sample_size: withoutNumber.sent
      },
    ];
  }, [subjectLines]);

  // Real segment × copy interactions from lead data
  const realSegmentCopyInteractions = useMemo(() => {
    // This will use the fetched segmentCopyInteractions from the database
    // For now, return the state which may have mock data until real data is connected
    return segmentCopyInteractions;
  }, [segmentCopyInteractions]);

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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <CardTitle className="text-lg">Top Performers</CardTitle>
                    </div>
                    {topPerformers.length > 0 && topPerformers[0].sent_count < 500 && (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Results may change with more data
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    Highest reply rate subject lines (min 100 sends) • Baseline: {formatRate(baselineReplyRate)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topPerformers.slice(0, 5).map((item, index) => {
                    const ci = calculateConfidenceInterval(item.reply_rate, item.sent_count);
                    const confidenceLevel = getConfidenceLevel(item.sent_count);
                    const liftVsBaseline = baselineReplyRate > 0 
                      ? ((item.reply_rate - baselineReplyRate) / baselineReplyRate) * 100 
                      : 0;
                    
                    return (
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
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-right flex-shrink-0 cursor-help">
                                    <div className="flex items-center gap-1">
                                      <p className="font-mono text-sm font-medium text-success">{formatRate(item.reply_rate)}</p>
                                      <span className="text-xs text-muted-foreground">
                                        ± {ci.marginOfError.toFixed(1)}%
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      n={item.sent_count.toLocaleString()}
                                      {liftVsBaseline > 0 && (
                                        <span className="text-success ml-1">+{liftVsBaseline.toFixed(0)}% vs avg</span>
                                      )}
                                    </p>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-medium mb-1">95% Confidence Interval</p>
                                  <p className="text-xs mb-1">
                                    Range: {ci.lower.toFixed(1)}% - {ci.upper.toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {confidenceLevel === 'low' && 'Need 200+ sends for medium confidence'}
                                    {confidenceLevel === 'medium' && 'Need 500+ sends for high confidence'}
                                    {confidenceLevel === 'high' && 'Statistically reliable result'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
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
                    );
                  })}
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
                  <div className="flex items-center gap-2">
                    {baselineReplyRate > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Baseline: {formatRate(baselineReplyRate)}
                      </Badge>
                    )}
                    {discoveredPatterns.some(p => p.is_validated) && (
                      <Badge className="bg-success/10 text-success border-success/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {discoveredPatterns.filter(p => p.is_validated).length} Validated
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>
                  Patterns compared against {formatRate(baselineReplyRate)} baseline reply rate
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
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="p-2 rounded-lg border bg-card text-card-foreground shadow-md">
                                    <p className="font-medium text-sm">{data.name}</p>
                                    <p className="text-sm">
                                      Reply Rate: <span className="font-mono font-medium">{data.reply_rate.toFixed(2)}%</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      vs {baselineReplyRate.toFixed(2)}% baseline = 
                                      <span className={data.lift > 0 ? ' text-success' : ' text-destructive'}>
                                        {data.lift > 0 ? ' +' : ' '}{data.lift.toFixed(0)}% lift
                                      </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Sample: n={data.sample_size.toLocaleString()}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="reply_rate" fill="hsl(var(--chart-1))">
                            {patternChartData.map((entry, index) => (
                              <Cell 
                                key={index} 
                                fill={entry.lift > 0 ? 'hsl(var(--success))' : 'hsl(var(--chart-1))'} 
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
                          <TableHead className="text-right">Rate (n=)</TableHead>
                          <TableHead className="text-right">vs Baseline</TableHead>
                          <TableHead className="text-right">p-value</TableHead>
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
                                        <p>Statistically validated (p &lt; 0.05)</p>
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
                                  <TooltipTrigger className="font-mono text-sm cursor-help">
                                    {formatRate(p.avg_reply_rate)}
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({p.sample_size >= 1000 ? `${(p.sample_size / 1000).toFixed(1)}k` : p.sample_size})
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="font-medium">Sample: {p.sample_size.toLocaleString()}</p>
                                    {p.confidence_interval_lower !== undefined && p.confidence_interval_upper !== undefined && (
                                      <p className="text-xs text-muted-foreground">
                                        95% CI: {p.confidence_interval_lower.toFixed(2)}% - {p.confidence_interval_upper.toFixed(2)}%
                                      </p>
                                    )}
                                    <p className="text-xs mt-1">
                                      <StatisticalConfidenceBadge sampleSize={p.sample_size} size="sm" showTooltip={false} />
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className={`font-medium ${p.comparison_to_baseline > 0 ? 'text-success' : 'text-destructive'}`}>
                                    {p.comparison_to_baseline > 0 ? '+' : ''}{p.comparison_to_baseline.toFixed(0)}%
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      {formatRate(p.avg_reply_rate)} vs {formatRate(baselineReplyRate)} baseline
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right">
                              {p.p_value !== undefined ? (
                                <span className={`font-mono text-xs ${p.p_value < 0.05 ? 'text-success font-medium' : 'text-muted-foreground'}`}>
                                  {p.p_value < 0.001 ? '<0.001' : p.p_value.toFixed(3)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
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
              <div className="flex items-center justify-between">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="overview">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="opening">
                    <MessageSquareText className="h-4 w-4 mr-2" />
                    Opening Lines
                  </TabsTrigger>
                  <TabsTrigger value="cta">
                    <Target className="h-4 w-4 mr-2" />
                    CTA Analysis
                  </TabsTrigger>
                  <TabsTrigger value="decay">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Decay
                    {decayingVariants.length > 0 && (
                      <Badge className="ml-1.5 bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs px-1.5">
                        {decayingVariants.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="segments">
                    <Users className="h-4 w-4 mr-2" />
                    Segment × Copy
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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsComparisonOpen(true)}
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare Variants
                </Button>
              </div>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Word Count Impact */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Body Length Impact</CardTitle>
                      <CardDescription>Reply rate by word count (with sample sizes)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={wordCountData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="range" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="p-2 rounded-lg border bg-card text-card-foreground shadow-md">
                                      <p className="font-medium text-sm">{data.range} words</p>
                                      <p className="text-sm">
                                        Reply Rate: <span className="font-mono font-medium">{data.avgReply.toFixed(2)}%</span>
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {data.count} variants • {data.totalSent.toLocaleString()} sends
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar 
                              dataKey="avgReply" 
                              fill="hsl(var(--chart-2))"
                              label={({ x, y, width, value, index }) => {
                                const data = wordCountData[index];
                                return (
                                  <g>
                                    <text
                                      x={x + width / 2}
                                      y={y - 5}
                                      fill="hsl(var(--foreground))"
                                      textAnchor="middle"
                                      fontSize={11}
                                      fontWeight={500}
                                    >
                                      {(value as number).toFixed(1)}%
                                    </text>
                                  </g>
                                );
                              }}
                            >
                              {wordCountData.map((entry, index) => (
                                <Cell 
                                  key={index} 
                                  fill={entry.range === bestWordCountBucket?.range ? 'hsl(var(--success))' : 'hsl(var(--chart-2))'} 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {bestWordCountBucket && bestWordCountBucket.totalSent > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-success/5 border border-success/20">
                          <p className="text-xs text-success">
                            <TrendingUp className="h-3 w-3 inline mr-1" />
                            <strong>Your data shows:</strong> {bestWordCountBucket.range} words performs best at {bestWordCountBucket.avgReply.toFixed(1)}% 
                            (n={bestWordCountBucket.totalSent.toLocaleString()})
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Key Metrics - Actionable */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Quick Stats</CardTitle>
                      <CardDescription>Actionable copy insights</CardDescription>
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
                          <p className="text-xs text-muted-foreground">
                            ({((subjectLines.filter(s => s.confidence_level === 'high').length / subjectLines.length) * 100).toFixed(0)}% of variants)
                          </p>
                        </div>
                      </div>
                      
                      {/* Question Format with Recommendation */}
                      {(() => {
                        const questionVariants = subjectLines.filter(s => s.format_type === 'question');
                        const questionUsage = (questionVariants.length / subjectLines.length) * 100;
                        const questionPattern = patterns.find(p => p.pattern.toLowerCase().includes('question'));
                        const lift = questionPattern?.comparison_to_baseline || 0;
                        
                        return (
                          <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">Question format</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{questionUsage.toFixed(0)}%</span>
                                {lift !== 0 && (
                                  <Badge className={`text-xs ${lift > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                    {lift > 0 ? '+' : ''}{lift.toFixed(0)}% lift
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Progress value={questionUsage} className="h-2" />
                            {lift > 10 && questionUsage < 25 && (
                              <p className="text-xs text-success">
                                💡 Increasing to 25% could generate more replies
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      
                      {/* Company Personalization with Recommendation */}
                      {(() => {
                        const companyVariants = subjectLines.filter(s => s.personalization_type === 'company');
                        const companyUsage = (companyVariants.length / subjectLines.length) * 100;
                        const companyPattern = patterns.find(p => p.pattern.toLowerCase().includes('company'));
                        const lift = companyPattern?.comparison_to_baseline || 0;
                        const topPerformersWithCompany = topPerformers.filter(t => t.personalization_type === 'company').length;
                        const topPerformersUsage = (topPerformersWithCompany / Math.max(topPerformers.length, 1)) * 100;
                        
                        return (
                          <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">Company personalization</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{companyUsage.toFixed(0)}%</span>
                                {lift !== 0 && (
                                  <Badge className={`text-xs ${lift > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                    {lift > 0 ? '+' : ''}{lift.toFixed(0)}% lift
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Progress value={companyUsage} className="h-2" />
                            {topPerformersUsage > companyUsage + 10 && (
                              <p className="text-xs text-success">
                                💡 Top performers use it {topPerformersUsage.toFixed(0)}% of the time
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Opening Lines Tab */}
              <TabsContent value="opening" className="space-y-4">
                <OpeningLineAnalysis 
                  openingMetrics={openingMetrics}
                  personalizationDepthData={personalizationDepthData}
                  youIRatioData={youIRatioData}
                />
              </TabsContent>

              {/* CTA Analysis Tab */}
              <TabsContent value="cta" className="space-y-4">
                <CTAAnalysisSection ctaMetrics={ctaMetrics} />
              </TabsContent>

              {/* Decay Tracking Tab */}
              <TabsContent value="decay" className="space-y-4">
                <CopyDecaySection 
                  decayingVariants={decayingVariants}
                  onPauseVariant={(variantId) => {
                    toast.info(`Pause variant ${variantId} - Coming soon`);
                  }}
                />
              </TabsContent>

              {/* Segment × Copy Matrix Tab */}
              <TabsContent value="segments" className="space-y-4">
                <SegmentCopyMatrix interactions={segmentCopyInteractions} />
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
                        {filteredSubjects.slice(0, 50).map((item) => {
                          const ci = calculateConfidenceInterval(item.reply_rate, item.sent_count);
                          return (
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
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="font-mono text-sm font-medium cursor-help">
                                    {formatRate(item.reply_rate)}
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ±{ci.marginOfError.toFixed(1)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">95% CI: {ci.lower.toFixed(1)}% - {ci.upper.toFixed(1)}%</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
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
                          );
                        })}
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
                          <TableHead>Bullets</TableHead>
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
                        {filteredBody.slice(0, 50).map((item) => {
                          const ci = calculateConfidenceInterval(item.reply_rate, item.sent_count);
                          return (
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
                                  item.bullet_count >= 2 && item.bullet_count <= 4
                                    ? 'bg-success/10 text-success border-success/30' 
                                    : item.bullet_count > 5 
                                    ? 'bg-destructive/10 text-destructive border-destructive/30'
                                    : ''
                                }`}
                              >
                                {item.bullet_count}
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
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="font-mono text-sm font-medium cursor-help">
                                    {formatRate(item.reply_rate)}
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ±{ci.marginOfError.toFixed(1)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">95% CI: {ci.lower.toFixed(1)}% - {ci.upper.toFixed(1)}%</p>
                                    <p className="text-xs text-muted-foreground">n={item.sent_count.toLocaleString()}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>
                              <StatisticalConfidenceBadge sampleSize={item.sent_count} size="sm" />
                            </TableCell>
                          </TableRow>
                          );
                        })}
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

      {/* Copy Comparison Dialog */}
      <CopyComparisonDialog
        open={isComparisonOpen}
        onOpenChange={setIsComparisonOpen}
        variants={subjectLines.map(s => {
          const body = bodyCopy.find(b => b.variant_id === s.variant_id);
          return {
            variant_id: s.variant_id,
            subject_line: s.subject_line,
            body_preview: body?.body_preview,
            campaign_name: s.campaign_name,
            sent_count: s.sent_count,
            reply_rate: s.reply_rate,
            positive_rate: s.positive_rate,
            meeting_rate: 0,
            subject_char_count: s.char_count,
            subject_format: s.format_type,
            body_word_count: body?.word_count || 0,
            cta_type: body?.cta_type || 'none',
            personalization_count: s.personalization_type !== 'none' ? 1 : 0,
            has_link: body?.has_link || false,
            tone: body?.body_tone,
          };
        })}
      />

      {/* AI Chat Panel */}
      <ChatPanel />
    </DashboardLayout>
  );
}
