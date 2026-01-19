import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Loader2, 
  FileText, 
  Sparkles,
  RefreshCw,
  BarChart3,
  MessageSquareText,
  AlignLeft,
  Target,
  ListOrdered,
  FlaskConical,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { DataHealthIndicator } from '@/components/ui/data-health-indicator';
import { useCopyAnalytics, type SubjectLineAnalysis } from '@/hooks/useCopyAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Import tab components
import { OverviewTab } from '@/components/copyinsights/tabs/OverviewTab';
import { SubjectLinesTab } from '@/components/copyinsights/tabs/SubjectLinesTab';
import { OpeningLinesTab } from '@/components/copyinsights/tabs/OpeningLinesTab';
import { BodyCopyTab } from '@/components/copyinsights/tabs/BodyCopyTab';
import { SequencesTab } from '@/components/copyinsights/tabs/SequencesTab';
import { ABTestsTab } from '@/components/copyinsights/tabs/ABTestsTab';
import { ChatPanel } from '@/components/copyinsights/ChatPanel';
import { SaveToLibraryDialog } from '@/components/copylibrary/SaveToLibraryDialog';

export default function CopyInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { subjectLines, bodyCopy, patterns, discoveredPatterns, topPerformers, recommendations, loading, error } = useCopyAnalytics();
  const [activeTab, setActiveTab] = useState('overview');
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
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

  const handleSaveToLibrary = useCallback((item: SubjectLineAnalysis) => {
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
  }, [bodyCopy]);

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

  // Calculate baseline reply rate
  const baselineReplyRate = useMemo(() => {
    const totalSent = subjectLines.reduce((sum, s) => sum + s.sent_count, 0);
    const totalReplies = subjectLines.reduce((sum, s) => sum + s.reply_count, 0);
    return totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;
  }, [subjectLines]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const hasData = subjectLines.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Copy Insights</h1>
              <p className="text-muted-foreground">
                The Message Laboratory – Turn opinions into data
              </p>
            </div>
            <DataHealthIndicator 
              status={hasData ? (patterns.length > 0 ? 'healthy' : 'degraded') : 'empty'} 
              tooltip={hasData 
                ? (patterns.length > 0 
                  ? `${subjectLines.length} variants, ${patterns.length} patterns` 
                  : `${subjectLines.length} variants but no patterns computed`) 
                : 'No copy data. Sync campaigns first.'}
            />
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="subjects" className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4" />
                <span className="hidden sm:inline">Subject Lines</span>
              </TabsTrigger>
              <TabsTrigger value="openings" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Opening Lines</span>
              </TabsTrigger>
              <TabsTrigger value="body" className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Body Copy</span>
              </TabsTrigger>
              <TabsTrigger value="sequences" className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4" />
                <span className="hidden sm:inline">Sequences</span>
              </TabsTrigger>
              <TabsTrigger value="tests" className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                <span className="hidden sm:inline">A/B Tests</span>
              </TabsTrigger>
              <TabsTrigger value="compare" className="flex items-center gap-2">
                <GitCompare className="h-4 w-4" />
                <span className="hidden sm:inline">Compare</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <OverviewTab
                subjectLines={subjectLines}
                patterns={patterns}
                discoveredPatterns={discoveredPatterns}
                recommendations={recommendations}
                baselineReplyRate={baselineReplyRate}
                onBackfill={handleBackfillAndRecompute}
                onRecompute={handleRecomputePatterns}
                isBackfilling={isBackfilling}
                isRecomputing={isRecomputing}
              />
            </TabsContent>

            <TabsContent value="subjects" className="mt-6">
              <SubjectLinesTab
                subjectLines={subjectLines}
                baselineReplyRate={baselineReplyRate}
                onSaveToLibrary={handleSaveToLibrary}
              />
            </TabsContent>

            <TabsContent value="openings" className="mt-6">
              <OpeningLinesTab
                bodyCopy={bodyCopy}
                baselineReplyRate={baselineReplyRate}
              />
            </TabsContent>

            <TabsContent value="body" className="mt-6">
              <BodyCopyTab
                bodyCopy={bodyCopy}
                baselineReplyRate={baselineReplyRate}
              />
            </TabsContent>

            <TabsContent value="sequences" className="mt-6">
              <SequencesTab />
            </TabsContent>

            <TabsContent value="tests" className="mt-6">
              <ABTestsTab />
            </TabsContent>

            <TabsContent value="compare" className="mt-6">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Compare Variants</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Select two or more variants to compare their performance side-by-side.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* AI Chat Panel */}
      <ChatPanel />

      {/* Save to Library Dialog */}
      <SaveToLibraryDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        variantData={saveVariantData ? {
          title: saveVariantData.subject_line,
          subject_line: saveVariantData.subject_line,
          body_html: saveVariantData.body_preview || undefined,
          body_plain: saveVariantData.body_preview || undefined,
          variant_id: saveVariantData.source_variant_id || undefined,
          performance: saveVariantData.performance ? {
            sent_count: saveVariantData.performance.sent_count,
            reply_rate: saveVariantData.performance.reply_rate,
            positive_rate: saveVariantData.performance.positive_rate,
            open_rate: undefined,
          } : undefined,
        } : null}
      />
    </DashboardLayout>
  );
}
