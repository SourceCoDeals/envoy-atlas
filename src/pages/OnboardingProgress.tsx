import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useCallLibrary } from '@/hooks/useCallLibrary';
import { GraduationCap, Play, CheckCircle2, Circle, BookOpen, Headphones, Users, MessageSquare, Target, Award } from 'lucide-react';

interface OnboardingPhase {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  tasks: OnboardingTask[];
}

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  type: 'listen' | 'read' | 'practice' | 'shadow' | 'review';
  linkedCallCount?: number;
}

const onboardingPhases: OnboardingPhase[] = [
  {
    id: 'orientation',
    name: 'Platform Orientation',
    description: 'Learn the tools and systems',
    icon: BookOpen,
    tasks: [
      { id: '1', title: 'Complete PhoneBurner training', description: 'Learn the dialer interface', completed: true, type: 'read' },
      { id: '2', title: 'Review CRM workflow', description: 'Understand lead management', completed: true, type: 'read' },
      { id: '3', title: 'Set up call recording', description: 'Ensure recordings are enabled', completed: true, type: 'practice' },
    ],
  },
  {
    id: 'immersion',
    name: 'Call Library Immersion',
    description: 'Listen to top-performing calls',
    icon: Headphones,
    tasks: [
      { id: '4', title: 'Listen to 5 "Best Opening" calls', description: 'Study different opening techniques', completed: true, type: 'listen', linkedCallCount: 5 },
      { id: '5', title: 'Listen to 5 "Discovery Excellence" calls', description: 'Learn discovery questioning', completed: false, type: 'listen', linkedCallCount: 5 },
      { id: '6', title: 'Listen to 5 "Objection Handling" calls', description: 'Study objection recovery patterns', completed: false, type: 'listen', linkedCallCount: 5 },
      { id: '7', title: 'Listen to 3 "Strong Close" calls', description: 'Learn closing techniques', completed: false, type: 'listen', linkedCallCount: 3 },
    ],
  },
  {
    id: 'shadowing',
    name: 'Live Shadowing',
    description: 'Observe experienced reps',
    icon: Users,
    tasks: [
      { id: '8', title: 'Shadow 2 dial sessions with senior rep', description: 'Observe live calling', completed: false, type: 'shadow' },
      { id: '9', title: 'Debrief after each session', description: 'Discuss what you observed', completed: false, type: 'review' },
    ],
  },
  {
    id: 'practice',
    name: 'Supervised Practice',
    description: 'Make calls with coaching',
    icon: MessageSquare,
    tasks: [
      { id: '10', title: 'Complete 50 supervised dials', description: 'Make calls with manager listening', completed: false, type: 'practice' },
      { id: '11', title: 'Review AI scores on first 20 calls', description: 'Analyze your performance', completed: false, type: 'review' },
      { id: '12', title: 'Weekly 1:1 coaching session', description: 'Discuss progress with manager', completed: false, type: 'review' },
    ],
  },
  {
    id: 'certification',
    name: 'Certification',
    description: 'Demonstrate competency',
    icon: Award,
    tasks: [
      { id: '13', title: 'Achieve avg AI score of 60+', description: 'Across 10 consecutive calls', completed: false, type: 'practice' },
      { id: '14', title: 'Set 2 meetings in a week', description: 'Demonstrate closing ability', completed: false, type: 'practice' },
      { id: '15', title: 'Pass script knowledge quiz', description: 'Demonstrate product knowledge', completed: false, type: 'read' },
    ],
  },
];

function PhaseCard({ phase, phaseIndex }: { phase: OnboardingPhase; phaseIndex: number }) {
  const [tasks, setTasks] = useState(phase.tasks);
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = (completedCount / tasks.length) * 100;
  const Icon = phase.icon;

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${progress === 100 ? 'bg-green-100 text-green-600' : 'bg-muted'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Phase {phaseIndex + 1}: {phase.name}
              </CardTitle>
              <Badge variant={progress === 100 ? 'default' : 'secondary'}>
                {completedCount}/{tasks.length}
              </Badge>
            </div>
            <CardDescription>{phase.description}</CardDescription>
          </div>
        </div>
        <Progress value={progress} className="h-2 mt-3" />
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => toggleTask(task.id)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={task.completed ? 'line-through text-muted-foreground' : 'font-medium'}>
                  {task.title}
                </span>
                {task.linkedCallCount && (
                  <Badge variant="outline" className="text-xs">
                    {task.linkedCallCount} calls
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
            {task.type === 'listen' && (
              <Button variant="ghost" size="sm">
                <Play className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function OnboardingProgress() {
  const { entries: libraryEntries = [] } = useCallLibrary();
  
  const allTasks = onboardingPhases.flatMap(p => p.tasks);
  const completedTasks = allTasks.filter(t => t.completed);
  const overallProgress = (completedTasks.length / allTasks.length) * 100;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Onboarding Progress</h1>
            <p className="text-muted-foreground">
              Track your journey to becoming a top-performing sales rep
            </p>
          </div>
          <Badge variant={overallProgress >= 100 ? 'default' : 'secondary'} className="text-lg px-3 py-1 w-fit">
            <GraduationCap className="h-4 w-4 mr-2" />
            {overallProgress.toFixed(0)}% Complete
          </Badge>
        </div>

        {/* Overall Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
            <CardDescription>
              {completedTasks.length} of {allTasks.length} tasks completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="h-3" />
            <div className="grid grid-cols-5 gap-2 mt-4">
              {onboardingPhases.map((phase, i) => {
                const phaseCompleted = phase.tasks.filter(t => t.completed).length;
                const phaseProgress = (phaseCompleted / phase.tasks.length) * 100;
                return (
                  <div key={phase.id} className="text-center">
                    <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${
                      phaseProgress === 100 ? 'bg-green-500 text-white' :
                      phaseProgress > 0 ? 'bg-primary text-primary-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {phaseProgress === 100 ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-medium">{i + 1}</span>
                      )}
                    </div>
                    <p className="text-xs mt-1 text-muted-foreground truncate">{phase.name}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Library Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Calls Listened</CardDescription>
              <CardTitle className="text-2xl">5 / 18</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={(5 / 18) * 100} className="h-2" />
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
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Days in Program</CardDescription>
              <CardTitle className="text-2xl">7</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Target: 21 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Phase Cards */}
        <div className="space-y-4">
          {onboardingPhases.map((phase, index) => (
            <PhaseCard key={phase.id} phase={phase} phaseIndex={index} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
