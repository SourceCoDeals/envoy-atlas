import { useAISummary } from '@/hooks/useAISummary';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { getScoreStatus, getScoreStatusColor, formatScore } from '@/lib/callingConfig';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Loader2,
  Zap,
  ArrowRight,
  Calendar,
  Phone,
  Clock,
  Star,
  MessageSquare,
  Users,
  Building2,
  Lightbulb,
  AlertCircle,
  Rocket,
  Shield,
  Activity,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function AISummary() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useAISummary();
  const { config, isLoading: configLoading } = useCallingConfig();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-success';
    if (change < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'medium':
        return 'bg-warning/10 text-warning border-warning/30';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getRecommendationTypeIcon = (type: string) => {
    switch (type) {
      case 'double_down':
        return <Rocket className="h-4 w-4 text-success" />;
      case 'test':
        return <Activity className="h-4 w-4 text-primary" />;
      case 'change':
        return <RefreshCw className="h-4 w-4 text-warning" />;
      case 'experiment':
        return <Lightbulb className="h-4 w-4 text-chart-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  // Config-based score coloring
  const getInterestScoreColor = (score: number) => {
    const status = getScoreStatus(score, config.sellerInterestThresholds);
    return getScoreStatusColor(status);
  };

  const getQualityScoreColor = (score: number) => {
    const status = getScoreStatus(score, config.overallQualityThresholds);
    return getScoreStatusColor(status);
  };

  const getObjectionScoreColor = (score: number) => {
    const status = getScoreStatus(score, config.objectionHandlingThresholds);
    return getScoreStatusColor(status);
  };

  const isLoading = loading || configLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Weekly Summary</h1>
            <p className="text-muted-foreground">
              {data ? `${format(data.weekStart, 'MMM d')} - ${format(data.weekEnd, 'MMM d, yyyy')}` : 'Program intelligence and recommendations'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings?tab=calling">
                <Settings className="h-4 w-4 mr-2" />
                Thresholds
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Last 7 Days
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          </div>
        ) : data ? (
          <>
            {/* 1. Program Overview with config-based coloring */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Program Overview (Last 7 Days)
              </h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      {getChangeIcon(data.previousWeekComparison.callsChange)}
                    </div>
                    <p className="text-2xl font-bold mt-2">{data.programOverview.totalCallsAnalyzed}</p>
                    <p className="text-xs text-muted-foreground">Total Calls Analyzed</p>
                    <p className={`text-xs mt-1 ${getChangeColor(data.previousWeekComparison.callsChange)}`}>
                      {data.previousWeekComparison.callsChange > 0 ? '+' : ''}{data.previousWeekComparison.callsChange}% vs last week
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <p className="text-2xl font-bold mt-2">{formatDuration(data.programOverview.avgCallTime)}</p>
                    <p className="text-xs text-muted-foreground">Avg Call Time</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <Star className="h-5 w-5 text-muted-foreground" />
                      {getChangeIcon(data.previousWeekComparison.interestChange)}
                    </div>
                    <p className={cn("text-2xl font-bold mt-2", getInterestScoreColor(data.programOverview.avgInterestRating))}>
                      {formatScore(data.programOverview.avgInterestRating, config)}/10
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Interest Rating</p>
                    <p className={`text-xs mt-1 ${getChangeColor(data.previousWeekComparison.interestChange)}`}>
                      {data.previousWeekComparison.interestChange > 0 ? '+' : ''}{data.previousWeekComparison.interestChange} vs last week
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <p className={cn("text-2xl font-bold mt-2", getObjectionScoreColor(data.programOverview.avgObjectionHandlingScore))}>
                      {formatScore(data.programOverview.avgObjectionHandlingScore, config)}/10
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Objection Handling</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <p className={cn("text-2xl font-bold mt-2", 
                      data.programOverview.avgResolutionRate >= config.objectionResolutionGoodThreshold 
                        ? 'text-success' 
                        : data.programOverview.avgResolutionRate >= config.objectionResolutionWarningThreshold
                          ? 'text-warning'
                          : 'text-destructive'
                    )}>
                      {data.programOverview.avgResolutionRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Resolution Rate</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Target: {config.objectionResolutionGoodThreshold}%+
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <p className={cn("text-2xl font-bold mt-2", getQualityScoreColor(data.programOverview.avgConversationQuality))}>
                      {formatScore(data.programOverview.avgConversationQuality, config)}/10
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Conversation Quality</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* 2. Seller Signal Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-success" />
                    Seller Signal Summary
                  </CardTitle>
                  <CardDescription>
                    Owners expressing interest (threshold: {config.hotLeadInterestScore}/10
                    {config.hotLeadRequiresInterestYes && ' + explicit interest'})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
                    <div>
                      <p className="text-3xl font-bold text-success">{data.sellerSignals.interestedOwnerCount}</p>
                      <p className="text-sm text-muted-foreground">Interested Owners</p>
                    </div>
                    <Building2 className="h-10 w-10 text-success/50" />
                  </div>

                  {data.sellerSignals.interestedCompanies.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Interested Companies</p>
                      <ScrollArea className="h-32">
                        <div className="space-y-2">
                          {data.sellerSignals.interestedCompanies.map((company) => (
                            <div 
                              key={company.id} 
                              className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 cursor-pointer"
                              onClick={() => navigate(`/calling/call-sessions?callId=${company.id}`)}
                            >
                              <div>
                                <p className="text-sm font-medium">{company.companyName}</p>
                                <p className="text-xs text-muted-foreground">{company.contactName}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={cn("bg-success/10", getInterestScoreColor(company.interestScore))}
                                >
                                  {company.interestScore}/10
                                </Badge>
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Top Industries</p>
                      <p className="text-sm">{data.sellerSignals.notablePatterns.topIndustries.slice(0, 2).join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Timeline</p>
                      <p className="text-sm">{data.sellerSignals.notablePatterns.avgTimeline}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Key Observations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-chart-4" />
                    Key Observations
                  </CardTitle>
                  <CardDescription>AI-generated insights from this week's calls</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.keyObservations.map((observation, index) => (
                      <div key={index} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-chart-4/20 flex items-center justify-center text-xs font-medium text-chart-4">
                          {index + 1}
                        </div>
                        <p className="text-sm">{observation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 4. Common Objections */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  Common Objections (Weekly Themes)
                </CardTitle>
                <CardDescription>
                  {data.commonObjections.totalObjections} total objections tracked this week
                  (Resolution target: {config.objectionResolutionGoodThreshold}%+)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.commonObjections.themes.length > 0 ? (
                  <div className="space-y-3">
                    {data.commonObjections.themes.map((theme, index) => (
                      <div key={index} className="flex items-center gap-4 p-3 rounded-lg border">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center font-bold text-warning text-sm">
                          {theme.count}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{theme.objection}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className={cn(
                              "flex items-center gap-1",
                              theme.resolutionRate >= config.objectionResolutionGoodThreshold
                                ? 'text-success'
                                : theme.resolutionRate >= config.objectionResolutionWarningThreshold
                                  ? 'text-warning'
                                  : 'text-destructive'
                            )}>
                              <Target className="h-3 w-3" />
                              {theme.resolutionRate}% resolved
                            </span>
                            <span className={`flex items-center gap-1 ${getChangeColor(theme.changeFromLastWeek)}`}>
                              {getChangeIcon(theme.changeFromLastWeek)}
                              {theme.changeFromLastWeek > 0 ? '+' : ''}{theme.changeFromLastWeek}% vs last week
                            </span>
                          </div>
                        </div>
                        <Progress value={theme.resolutionRate} className="w-20" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Not enough objection data to display themes
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* 5. Program Strengths */}
              <Card className="border-success/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="h-5 w-5 text-success" />
                    Program Strengths
                  </CardTitle>
                  <CardDescription>What's working well this week</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.programStrengths.map((strength, index) => (
                    <div key={index} className="p-3 rounded-lg bg-success/5 border border-success/20">
                      <p className="font-medium text-sm">{strength.strength}</p>
                      <p className="text-xs text-success mt-1">{strength.impact}</p>
                      {strength.example && (
                        <p className="text-xs text-muted-foreground mt-1">→ {strength.example}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 6. Program Weaknesses */}
              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsDown className="h-5 w-5 text-destructive" />
                    Program Weaknesses & Gaps
                  </CardTitle>
                  <CardDescription>Areas needing improvement (below coaching thresholds)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.programWeaknesses.map((weakness, index) => (
                    <div key={index} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <p className="font-medium text-sm">{weakness.weakness}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs">
                        <span className="text-muted-foreground">{weakness.frequency}</span>
                        <span className="text-destructive">{weakness.impact}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* 7. Improvement Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Improvement Opportunities
                </CardTitle>
                <CardDescription>Actionable recommendations for next week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.improvementOpportunities.map((opp, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 rounded-lg border hover:border-primary/50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{opp.area}</p>
                          <Badge className={getPriorityColor(opp.priority)}>{opp.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{opp.recommendation}</p>
                      </div>
                      <Badge variant="outline">{opp.owner}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 8. AI Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  AI Recommendations for Next Week
                </CardTitle>
                <CardDescription>Strategic priorities based on this week's performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.aiRecommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border">
                      <div className="flex-shrink-0 mt-0.5">
                        {getRecommendationTypeIcon(rec.type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{rec.action}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {rec.type.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Predicted Impact: <span className="text-primary font-medium">{rec.predictedImpact}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No AI Summary Available</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Not enough call data to generate a summary. Make sure calls are being synced and scored.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
