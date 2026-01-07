import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCallLibrary } from '@/hooks/useCallLibrary';
import { GraduationCap, Play, CheckCircle2, Clock, User, Target, Headphones } from 'lucide-react';

interface TrainingAssignment {
  id: string;
  callId: string;
  callTitle: string;
  category: string;
  focusArea: string;
  assignedBy: string;
  dueDate: string;
  completed: boolean;
  notes?: string;
}

// Mock data - would come from database in real implementation
const mockAssignments: TrainingAssignment[] = [
  {
    id: '1',
    callId: 'call-1',
    callTitle: 'Strong Discovery Call - Manufacturing CEO',
    category: 'discovery_excellence',
    focusArea: 'Note how rep builds rapport before asking about timeline',
    assignedBy: 'John Manager',
    dueDate: '2026-01-10',
    completed: false,
  },
  {
    id: '2',
    callId: 'call-2',
    callTitle: '"Not Interested" Recovery',
    category: 'objection_handling',
    focusArea: 'Study the pattern: acknowledge → reframe → value statement',
    assignedBy: 'John Manager',
    dueDate: '2026-01-08',
    completed: true,
  },
];

function AssignmentCard({ assignment }: { assignment: TrainingAssignment }) {
  const [completed, setCompleted] = useState(assignment.completed);

  return (
    <Card className={completed ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={completed}
            onCheckedChange={(checked) => setCompleted(!!checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{assignment.callTitle}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {assignment.focusArea}
                </p>
              </div>
              <Badge variant={
                assignment.category === 'discovery_excellence' ? 'default' :
                assignment.category === 'objection_handling' ? 'secondary' :
                'outline'
              }>
                {assignment.category.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Assigned by {assignment.assignedBy}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Due {new Date(assignment.dueDate).toLocaleDateString()}
              </span>
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
  const { entries: libraryEntries = [] } = useCallLibrary();
  
  const pendingAssignments = mockAssignments.filter(a => !a.completed);
  const completedAssignments = mockAssignments.filter(a => a.completed);
  const completionRate = mockAssignments.length > 0 
    ? (completedAssignments.length / mockAssignments.length) * 100 
    : 0;

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
          <Badge variant="secondary" className="text-lg px-3 py-1 w-fit">
            <GraduationCap className="h-4 w-4 mr-2" />
            {pendingAssignments.length} Pending
          </Badge>
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
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed This Week</CardDescription>
              <CardTitle className="text-2xl">{completedAssignments.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Reviews done</p>
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

        {/* Assignments */}
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingAssignments.length})
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
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>All caught up!</p>
                  <p className="text-sm mt-1">No pending training assignments</p>
                </CardContent>
              </Card>
            ) : (
              pendingAssignments.map(assignment => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
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
                <AssignmentCard key={assignment.id} assignment={assignment} />
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
                        <Badge variant="outline">{entry.category.replace('_', ' ')}</Badge>
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
