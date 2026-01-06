import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Trophy,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  FileText,
  Clock,
  Mail,
} from 'lucide-react';
import { useCopyInsights } from '@/hooks/useCopyInsights';
import { TemplateCard } from '@/components/playbook/TemplateCard';
import { PlaybookFilters } from '@/components/playbook/PlaybookFilters';
import { getConfidenceLevel, detectEmailStep } from '@/lib/textUtils';

interface WinningTemplate {
  id: string;
  variant_name: string;
  campaign_name: string;
  subject_line: string;
  body_preview: string | null;
  word_count: number;
  personalization_vars: string[];
  reply_rate: number;
  positive_rate: number;
  sent_count: number;
}

// Industry benchmarks from the guide
const BEST_PRACTICES = [
  {
    category: 'Subject Lines',
    icon: MessageSquare,
    tips: [
      { title: 'Keep it Short', description: 'Under 50 characters for mobile visibility' },
      { title: 'Use Questions', description: 'Questions often outperform statements (+22% avg lift)' },
      { title: 'Personalization', description: '{{first_name}} or {{company}} improves opens by 14-20%' },
      { title: 'Avoid Spam Triggers', description: 'Skip ALL CAPS, excessive punctuation, and sales words' },
    ],
  },
  {
    category: 'Email Body',
    icon: FileText,
    tips: [
      { title: 'Optimal Length', description: '75-125 words is the sweet spot for cold email' },
      { title: 'No Links (First Touch)', description: 'Links hurt deliverability on first cold emails' },
      { title: 'Choice CTA', description: '"Tuesday or Thursday?" drives 75% more meetings than soft asks' },
      { title: 'You:I Ratio', description: 'Focus on prospect (2:1 ratio of "you" to "I" performs best)' },
    ],
  },
  {
    category: 'Send Timing',
    icon: Clock,
    tips: [
      { title: 'Best Days', description: 'Tuesday-Thursday typically perform 15-20% better' },
      { title: 'Peak Hours', description: '8-11 AM or 4-6 PM in prospect timezone' },
      { title: 'Follow-up Spacing', description: '2-3 days between first emails, extend for later steps' },
      { title: 'Timezone Targeting', description: 'Send based on prospect location, not yours' },
    ],
  },
  {
    category: 'Deliverability',
    icon: Mail,
    tips: [
      { title: 'Bounce Rate', description: 'Keep under 3%, ideally under 2%' },
      { title: 'Spam Complaints', description: 'MUST stay under 0.3% (Google requirement)' },
      { title: 'Warmup Accounts', description: 'New domains need 2-4 weeks warmup' },
      { title: 'Daily Volume', description: '30-100 emails per mailbox per day max' },
    ],
  },
];

const REPLY_RATE_THRESHOLD = 5; // Minimum reply rate to be a "winner"

export default function Playbook() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { data: copyData, loading: copyLoading } = useCopyInsights();
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [stepFilter, setStepFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('reply_rate');
  const [minSends, setMinSends] = useState(50);
  const [activeTab, setActiveTab] = useState('winners');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Process winning templates from copy data
  const winningTemplates: WinningTemplate[] = useMemo(() => {
    return copyData
      .filter(item => item.reply_rate >= REPLY_RATE_THRESHOLD && item.sent_count >= minSends)
      .map(item => ({
        id: item.variant_id,
        variant_name: item.variant_name,
        campaign_name: item.campaign_name,
        subject_line: item.subject_line,
        body_preview: item.body_preview,
        word_count: item.word_count,
        personalization_vars: item.personalization_vars,
        reply_rate: item.reply_rate,
        positive_rate: item.positive_rate,
        sent_count: item.sent_count,
      }));
  }, [copyData, minSends]);

  // Apply filters and sorting
  const filteredTemplates = useMemo(() => {
    let result = [...winningTemplates];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.subject_line?.toLowerCase().includes(query) ||
        t.campaign_name?.toLowerCase().includes(query) ||
        t.body_preview?.toLowerCase().includes(query)
      );
    }
    
    // Step filter
    if (stepFilter !== 'all') {
      result = result.filter(t => {
        const step = detectEmailStep(t.variant_name || t.campaign_name);
        return step === stepFilter;
      });
    }
    
    // Confidence filter
    if (confidenceFilter === 'high') {
      result = result.filter(t => t.sent_count >= 500);
    } else if (confidenceFilter === 'medium') {
      result = result.filter(t => t.sent_count >= 200);
    }
    
    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'positive_rate':
          return b.positive_rate - a.positive_rate;
        case 'sent_count':
          return b.sent_count - a.sent_count;
        case 'reply_rate':
        default:
          return b.reply_rate - a.reply_rate;
      }
    });
    
    return result;
  }, [winningTemplates, searchQuery, stepFilter, confidenceFilter, sortBy]);

  // Stats
  const highConfidenceCount = winningTemplates.filter(t => t.sent_count >= 500).length;
  const avgReplyRate = winningTemplates.length > 0
    ? winningTemplates.reduce((sum, t) => sum + t.reply_rate, 0) / winningTemplates.length
    : 0;

  const loading = authLoading || copyLoading;

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Playbook</h1>
          <p className="text-muted-foreground">
            Proven templates and best practices from your campaigns
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="winners" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Winning Templates
                {winningTemplates.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{winningTemplates.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="practices" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Best Practices
              </TabsTrigger>
              <TabsTrigger value="benchmarks" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Benchmarks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="winners" className="space-y-4">
              {winningTemplates.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Trophy className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No Winners Yet</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                      Templates with {REPLY_RATE_THRESHOLD}%+ reply rate will appear here automatically.
                      Keep testing and your best performers will be archived.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Winners</p>
                            <p className="text-2xl font-bold">{winningTemplates.length}</p>
                          </div>
                          <Trophy className="h-8 w-8 text-success/50" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">High Confidence</p>
                            <p className="text-2xl font-bold">{highConfidenceCount}</p>
                          </div>
                          <CheckCircle2 className="h-8 w-8 text-success/50" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">500+ sends</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Reply Rate</p>
                            <p className="text-2xl font-bold">{avgReplyRate.toFixed(1)}%</p>
                          </div>
                          <MessageSquare className="h-8 w-8 text-primary/50" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Shown</p>
                            <p className="text-2xl font-bold">{filteredTemplates.length}</p>
                          </div>
                          <FileText className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">After filters</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Low Confidence Warning */}
                  {highConfidenceCount < winningTemplates.length && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{winningTemplates.length - highConfidenceCount} templates</strong> have less than 500 sends.
                        These results may not be statistically reliable. Use the confidence filter to focus on proven winners.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Filters */}
                  <PlaybookFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    stepFilter={stepFilter}
                    onStepFilterChange={setStepFilter}
                    confidenceFilter={confidenceFilter}
                    onConfidenceFilterChange={setConfidenceFilter}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    minSends={minSends}
                    onMinSendsChange={setMinSends}
                  />

                  {/* Template Grid */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredTemplates.map((template, index) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        rank={index + 1}
                      />
                    ))}
                  </div>

                  {filteredTemplates.length === 0 && winningTemplates.length > 0 && (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground">
                          No templates match your current filters. Try adjusting the filters above.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="practices" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {BEST_PRACTICES.map(section => {
                  const Icon = section.icon;
                  return (
                    <Card key={section.category}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Icon className="h-5 w-5 text-primary" />
                          {section.category}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {section.tips.map((tip, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{tip.title}</p>
                                <p className="text-xs text-muted-foreground">{tip.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="benchmarks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Industry Benchmarks</CardTitle>
                  <CardDescription>
                    Reference thresholds for evaluating your cold email performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-3">Open Rate</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Good</span>
                          <Badge variant="outline">30-40%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Excellent</span>
                          <Badge className="bg-success/20 text-success border-success/30">50%+</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Note: Opens are directional only due to tracking limitations
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-3">Reply Rate</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Average</span>
                          <Badge variant="outline">1-3%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Good</span>
                          <Badge variant="outline">3-5%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Excellent</span>
                          <Badge className="bg-success/20 text-success border-success/30">5-10%</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Primary metric - indicates true engagement
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-3">Positive Reply Rate</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Average</span>
                          <Badge variant="outline">30-40% of replies</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Excellent</span>
                          <Badge className="bg-success/20 text-success border-success/30">50%+ of replies</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Interested responses vs all replies
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-3">Bounce Rate</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Acceptable</span>
                          <Badge variant="outline">&lt; 5%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Excellent</span>
                          <Badge className="bg-success/20 text-success border-success/30">&lt; 2%</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Higher indicates list quality issues
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-3">Spam Complaint Rate</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-warning">Max Allowed</span>
                          <Badge className="bg-warning/20 text-warning border-warning/30">&lt; 0.3%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Safe</span>
                          <Badge className="bg-success/20 text-success border-success/30">&lt; 0.1%</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Google blocks senders above 0.3%
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-3">Meeting Conversion</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Average</span>
                          <Badge variant="outline">0.2-0.5%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Excellent</span>
                          <Badge className="bg-success/20 text-success border-success/30">1%+</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Ultimate success metric
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sample Size Guidance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Statistical Confidence Guide</CardTitle>
                  <CardDescription>
                    Minimum sample sizes needed to trust your results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="font-medium">Low Confidence</span>
                      </div>
                      <p className="text-2xl font-bold mb-1">&lt; 200 sends</p>
                      <p className="text-xs text-muted-foreground">
                        Results may be noise. Can only detect very large differences (100%+ lift).
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Medium Confidence</span>
                      </div>
                      <p className="text-2xl font-bold mb-1">200-500 sends</p>
                      <p className="text-xs text-muted-foreground">
                        Directionally reliable. Can detect 50%+ relative lifts.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border border-success/30 bg-success/5">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="font-medium">High Confidence</span>
                      </div>
                      <p className="text-2xl font-bold mb-1">500+ sends</p>
                      <p className="text-xs text-muted-foreground">
                        Statistically reliable. Can detect 25%+ relative lifts.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
