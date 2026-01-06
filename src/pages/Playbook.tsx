import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  BookOpen,
  Trophy,
  Search,
  Star,
  FileText,
  TrendingUp,
  Copy,
  CheckCircle2,
  MessageSquare,
  Mail,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCopyInsights } from '@/hooks/useCopyInsights';
import { toast } from 'sonner';

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
  category: 'subject_line' | 'sequence' | 'follow_up';
}

// Industry benchmarks from the guide
const BEST_PRACTICES = [
  {
    category: 'Subject Lines',
    icon: MessageSquare,
    tips: [
      { title: 'Keep it Short', description: 'Under 50 characters for mobile visibility' },
      { title: 'Use Questions', description: 'Questions often outperform statements' },
      { title: 'Personalization', description: '{{first_name}} or {{company}} improves opens' },
      { title: 'Avoid Spam Triggers', description: 'Skip ALL CAPS, excessive punctuation, and sales words' },
    ],
  },
  {
    category: 'Email Body',
    icon: FileText,
    tips: [
      { title: 'Optimal Length', description: '50-200 words, 6-8 sentences max' },
      { title: 'No Links (First Email)', description: 'Links hurt deliverability on cold emails' },
      { title: 'Soft CTA', description: '"Would you be open to a quick chat?" vs hard sell' },
      { title: 'Personalize Pain Points', description: 'Reference industry-specific challenges' },
    ],
  },
  {
    category: 'Send Timing',
    icon: Clock,
    tips: [
      { title: 'Best Days', description: 'Tuesday-Thursday typically perform best' },
      { title: 'Peak Hours', description: '8-11 AM or 4-6 PM in prospect timezone' },
      { title: 'Follow-up Spacing', description: '2-3 days between first emails, extend for later steps' },
      { title: 'Timezone Targeting', description: 'Send based on prospect location, not yours' },
    ],
  },
  {
    category: 'Deliverability',
    icon: Mail,
    tips: [
      { title: 'Bounce Rate', description: 'Keep under 5%, ideally under 2%' },
      { title: 'Spam Complaints', description: 'MUST stay under 0.3% (Google requirement)' },
      { title: 'Warmup Accounts', description: 'New domains need 2-4 weeks warmup' },
      { title: 'Daily Volume', description: '30-100 emails per mailbox per day' },
    ],
  },
];

const REPLY_RATE_THRESHOLD = 5; // Minimum reply rate to be a "winner"

export default function Playbook() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { data: copyData, loading: copyLoading } = useCopyInsights();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('winners');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Process winning templates from copy data
  const winningTemplates: WinningTemplate[] = copyData
    .filter(item => item.reply_rate >= REPLY_RATE_THRESHOLD && item.sent_count >= 50)
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
      category: (item.variant_name.toLowerCase().includes('follow') ? 'follow_up' : 
                item.variant_name.toLowerCase().includes('step') ? 'sequence' : 'subject_line') as 'subject_line' | 'sequence' | 'follow_up',
    }))
    .sort((a, b) => b.reply_rate - a.reply_rate);

  const filteredTemplates = winningTemplates.filter(t =>
    t.subject_line?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.body_preview?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

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
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Templates with {REPLY_RATE_THRESHOLD}%+ reply rate from at least 50 sends
                    </p>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredTemplates.map((template, index) => (
                      <Card key={template.id} className={index < 3 ? 'border-success/30' : ''}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {index < 3 && (
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success/20">
                                  <Trophy className="h-3 w-3 text-success" />
                                </div>
                              )}
                              <Badge variant="outline" className="text-xs">
                                #{index + 1}
                              </Badge>
                              <Badge 
                                className={`text-xs ${
                                  template.reply_rate >= 10 
                                    ? 'bg-success/20 text-success border-success/30' 
                                    : 'bg-primary/20 text-primary border-primary/30'
                                }`}
                              >
                                {template.reply_rate.toFixed(1)}% reply
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(template.subject_line, 'Subject line')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Subject Line</p>
                              <p className="font-medium">{template.subject_line}</p>
                            </div>
                            
                            {template.body_preview && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Preview</p>
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                  {template.body_preview}
                                </p>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {template.word_count} words
                              </Badge>
                              {template.personalization_vars.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {template.personalization_vars.length} personalization vars
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {template.sent_count.toLocaleString()} sent
                              </Badge>
                            </div>

                            <div className="pt-2 border-t">
                              <p className="text-xs text-muted-foreground">
                                {template.campaign_name} · {template.variant_name}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
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
                          <span className="text-muted-foreground">Good</span>
                          <Badge variant="outline">5-8%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Excellent</span>
                          <Badge className="bg-success/20 text-success border-success/30">10-15%</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Primary metric - indicates true engagement
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
                        Google 2024 requirement: must stay below 0.3%
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-3">Positive Reply Rate</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Good</span>
                          <Badge variant="outline">2-4%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Excellent</span>
                          <Badge className="bg-success/20 text-success border-success/30">5%+</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Qualified interest vs. negative responses
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-3">Conversion Rate</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Good</span>
                          <Badge variant="outline">1-3%</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-success">Excellent</span>
                          <Badge className="bg-success/20 text-success border-success/30">5%+</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Leads to meetings/demos booked
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Insight */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Star className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium mb-1">Key Insight</p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Focus on Reply Rate over Open Rate.</strong> Opens are unreliable due to 
                        pixel tracking limitations. Replies indicate true engagement and predict pipeline.
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
