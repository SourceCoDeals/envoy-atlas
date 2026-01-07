import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Plug,
  Mail,
  Users,
  Library,
  Sparkles,
  Inbox,
  BookOpen,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Check,
  Circle,
} from 'lucide-react';

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  welcome: Rocket,
  'connect-data': Plug,
  'review-campaigns': Mail,
  'audience-insights': Users,
  'copy-library': Library,
  'copywriting-studio': Sparkles,
  inbox: Inbox,
  playbook: BookOpen,
};

export function OnboardingModal() {
  const navigate = useNavigate();
  const {
    isOnboardingOpen,
    setIsOnboardingOpen,
    currentStep,
    setCurrentStep,
    steps,
    markStepCompleted,
    completionPercentage,
  } = useOnboarding();

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const StepIcon = step ? stepIcons[step.id] || Circle : Circle;

  const handleNext = () => {
    if (step) {
      markStepCompleted(step.id);
    }
    if (isLastStep) {
      setIsOnboardingOpen(false);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGoToFeature = () => {
    if (step?.route) {
      markStepCompleted(step.id);
      setIsOnboardingOpen(false);
      navigate(step.route);
    }
  };

  const handleSkip = () => {
    setIsOnboardingOpen(false);
  };

  if (!step) return null;

  return (
    <Dialog open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="text-xs">
              Step {currentStep + 1} of {steps.length}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {completionPercentage}% complete
            </span>
          </div>
          <Progress value={completionPercentage} className="h-1 mb-4" />

          <div className="flex items-center gap-4 pt-2">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <StepIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{step.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {step.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step content */}
        <div className="py-4">
          <StepContent stepId={step.id} />
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5 py-2">
          {steps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(idx)}
              className={cn(
                'h-2 rounded-full transition-all',
                idx === currentStep
                  ? 'w-6 bg-primary'
                  : s.completed
                  ? 'w-2 bg-primary/50'
                  : 'w-2 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleSkip} className="sm:mr-auto">
            Skip tutorial
          </Button>
          <div className="flex gap-2">
            {!isFirstStep && (
              <Button variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {step.route && (
              <Button variant="outline" onClick={handleGoToFeature}>
                Go to {step.title.split(' ').slice(-1)[0]}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            <Button onClick={handleNext}>
              {isLastStep ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepContent({ stepId }: { stepId: string }) {
  switch (stepId) {
    case 'welcome':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Welcome! This quick tutorial will walk you through the key features of the platform.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard
              icon={Mail}
              title="Campaign Analytics"
              description="Track performance metrics"
            />
            <FeatureCard
              icon={Sparkles}
              title="AI Copywriting"
              description="Generate optimized sequences"
            />
            <FeatureCard
              icon={Users}
              title="Audience Insights"
              description="Understand your segments"
            />
            <FeatureCard
              icon={Library}
              title="Copy Library"
              description="Save & reuse templates"
            />
          </div>
        </div>
      );

    case 'connect-data':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your email platforms to start syncing campaign data automatically.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Supported Platforms:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Smartlead - Full sync support
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Reply.io - Coming soon
              </li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Your API key is encrypted and stored securely.
          </p>
        </div>
      );

    case 'review-campaigns':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Once connected, your campaigns will appear with detailed analytics.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">What you can track:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Open rates, click rates, reply rates
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Positive vs negative reply classification
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Sequence step performance
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                A/B test results
              </li>
            </ul>
          </div>
        </div>
      );

    case 'audience-insights':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Analyze your audience segments to understand what resonates with different groups.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Key insights include:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Segment performance rankings
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Fatigue monitoring
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                ICP validation
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Volume allocation recommendations
              </li>
            </ul>
          </div>
        </div>
      );

    case 'copy-library':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Save your best-performing copy variations to reuse and remix later.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Library features:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Organize by category (intro, follow-up, breakup, etc.)
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                AI-generated tags for easy filtering
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Performance snapshots
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Mark entries as templates
              </li>
            </ul>
          </div>
        </div>
      );

    case 'copywriting-studio':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate AI-powered outreach sequences optimized with best practices.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Studio capabilities:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Multi-channel sequences (email, LinkedIn, phone)
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Upload call transcripts for context
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Industry-specific intelligence
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Quality scoring with constraint checks
              </li>
            </ul>
          </div>
        </div>
      );

    case 'inbox':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Manage replies and track conversations in one place.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Inbox features:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                AI-powered reply classification
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Filter by positive, neutral, objection
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                View full conversation threads
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Quick actions for follow-up
              </li>
            </ul>
          </div>
        </div>
      );

    case 'playbook':
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Learn from proven patterns and best practices to improve your outreach.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Playbook includes:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Subject line best practices
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Email body constraints & patterns
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Winning experiment results
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                Anti-patterns to avoid
              </li>
            </ul>
          </div>
        </div>
      );

    default:
      return null;
  }
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
