import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useCallLibrary } from '@/hooks/useCallLibrary';
import { useTrainingAssignments, TrainingAssignment } from '@/hooks/useTrainingAssignments';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { needsCoachingReview, formatScore, getScoreStatus, getScoreStatusColor } from '@/lib/callingConfig';
import { GraduationCap, Play, CheckCircle2, Clock, User, Target, Headphones, AlertTriangle, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

function AssignmentCard({ 
  assignment, 
  onToggleComplete,
  config 
}: { 
  assignment: TrainingAssignment;
  onToggleComplete: (id: string, completed: boolean) => void;
  config: ReturnType<typeof useCallingConfig>['config'];
}) {
  const isCompleted = !!assignment.completed_at;
  const callTitle = assignment.call 
    ? `${assignment.call.contact_name || 'Unknown'} - ${assignment.call.company_name || 'Unknown Company'}`
    : 'Call Recording';

  // Check if call needs coaching based on config thresholds
  const callNeedsCoaching = assignment.call && needsCoachingReview({
    overall_quality_score: assignment.call.overall_quality_score,
    objection_handling_score: assignment.call.objection_handling_score,
    script_adherence_score: assignment.call.script_adherence_score,
    question_adherence_score: assignment.call.question_adherence_score,
  }, config);

  const callScore = assignment.call?.overall_quality_score;
  const scoreStatus = callScore != null ? getScoreStatus(callScore, config.overallQualityThresholds) : 'none';

  return (
    <Card className={cn(
      isCompleted ? 'opacity-60' : '',
      callNeedsCoaching && !isCompleted && 'border-warning/50'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={(checked) => onToggleComplete(assignment.id, !!checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{callTitle}</h4>
                  {callNeedsCoaching && !isCompleted && (
                    <Badge variant="outline" className="text-warning border-warning/50">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Needs Review
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {assignment.focus_area || 'Review this call for training purposes'}
                </p>
                {callScore != null && (
                  <Badge 
                    variant="outline" 
                    className={cn("mt-2 text-xs", getScoreStatusColor(scoreStatus))}
                  >
                    Score: {formatScore(callScore, config)} ({scoreStatus})
                  </Badge>
                )}
              </div>
              <Badge variant={
                assignment.assignment_type === 'discovery_excellence' ? 'default' :
                assignment.assignment_type === 'objection_handling' ? 'secondary' :
                'outline'
              }>
                {assignment.assignment_type?.replace(/_/g, ' ') || 'Training'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Assigned by {assignment.assigner?.full_name || assignment.assigner?.email || 'Manager'}
              </span>
              {assignment.due_date && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Due {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <Play className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrainingQueue() {
  const { entries: libraryEntries = [], isLoading: isLoadingLibrary } = useCallLibrary();
  const { 
    pendingAssignments, 
    completedAssignments, 
    assignments,
    isLoading: isLoadingAssignments,
    markComplete,
    markIncomplete 
  } = useTrainingAssignments();
  const { config, isLoading: configLoading } = useCallingConfig();
  
  const isLoading = isLoadingAssignments || isLoadingLibrary || configLoading;
  
  const completionRate = assignments.length > 0 
    ? (completedAssignments.length / assignments.length) * 100 
    : 0;

  // Count assignments that need coaching review based on config
  const needsReviewCount = pendingAssignments.filter(a => {
    if (!a.call) return false;
    return needsCoachingReview({
      overall_quality_score: a.call.overall_quality_score,
      objection_handling_score: a.call.objection_handling_score,
      script_adherence_score: a.call.script_adherence_score,
      question_adherence_score: a.call.question_adherence_score,
    }, config);
  }).length;

  const handleToggleComplete = (assignmentId: string, completed: boolean) => {
    if (completed) {
      markComplete.mutate();
    } else {
      markIncomplete.mutate();
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Training Queue</h1>
            <p className="text-muted-foreground">
              Assigned call reviews and coaching materials
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings?tab=calling">
                <Settings className="h-4 w-4 mr-2" />
                Thresholds
              </Link>
            </Button>
            <Badge variant="secondary" className="text-lg px-3 py-1 w-fit">
              <GraduationCap className="h-4 w-4 mr-2" />
              {pendingAssignments.length} Pending
            </Badge>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completion Rate</CardDescription>
              <CardTitle className="text-2xl">{completionRate.toFixed(0)}%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={completionRate} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Reviews</CardDescription>
              <CardTitle className="text-2xl">{pendingAssignments.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Calls to listen to</p>
            </CardContent>
          </Card>
          <Card className={needsReviewCount > 0 ? 'border-warning/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription>Needs Coaching Review</CardDescription>
              <CardTitle className={cn("text-2xl", needsReviewCount > 0 && "text-warning")}>
                {needsReviewCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Calls below coaching thresholds
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Library Calls Available</CardDescription>
              <CardTitle className="text-2xl">{libraryEntries.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Best practice examples</p>
            </CardContent>
          </Card>
        </div>

        {/* Coaching Thresholds Info */}
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-6 text-sm">
              <span className="text-muted-foreground">Coaching Alert Thresholds:</span>
              <span>Overall: &lt;{config.coachingAlertOverallQuality}</span>
              <span>Objections: &lt;{config.coachingAlertObjectionHandling}</span>
              <span>Script: &lt;{config.coachingAlertScriptAdherence}</span>
              <span>Questions: &lt;{config.coachingAlertQuestionAdherence}</span>
            </div>
          </CardContent>
        </Card>

        {/* Assignments */}
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingAssignments.length})
              {needsReviewCount > 0 && (
                <Badge variant="outline" className="ml-2 text-warning border-warning/50">
                  {needsReviewCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="library">
              Self-Study Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-success" />
                  <p>All caught up!</p>
                  <p className="text-sm mt-1">No pending training assignments</p>
                </CardContent>
              </Card>
            ) : (
              pendingAssignments.map(assignment => (
                <AssignmentCard 
                  key={assignment.id} 
                  assignment={assignment} 
                  onToggleComplete={handleToggleComplete}
                  config={config}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-4">
            {completedAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed reviews yet</p>
                </CardContent>
              </Card>
            ) : (
              completedAssignments.map(assignment => (
                <AssignmentCard 
                  key={assignment.id} 
                  assignment={assignment}
                  onToggleComplete={handleToggleComplete}
                  config={config}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="library" className="space-y-4 mt-4">
            {libraryEntries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No library entries yet</p>
                  <p className="text-sm mt-1">Best calls will appear here for self-study</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {libraryEntries.map(entry => (
                  <Card key={entry.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{entry.title}</CardTitle>
                        <Badge variant="outline">{entry.category.replace(/_/g, ' ')}</Badge>
                      </div>
                      <CardDescription>{entry.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {entry.tags?.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="mt-4 w-full">
                        <Play className="h-4 w-4 mr-2" />
                        Listen
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
