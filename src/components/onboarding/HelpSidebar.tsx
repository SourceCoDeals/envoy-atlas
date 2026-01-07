import { useLocation, useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Check,
  Circle,
  ChevronRight,
  Play,
  RotateCcw,
  HelpCircle,
  Lightbulb,
  ExternalLink,
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

// Contextual tips based on current page
const pageTips: Record<string, { title: string; tips: string[] }> = {
  '/': {
    title: 'Dashboard Tips',
    tips: [
      'Check the Action Queue for priority tasks',
      'Review key metrics at a glance',
      'Click on any metric card to drill down',
      'Use the date filter to change the time range',
    ],
  },
  '/campaigns': {
    title: 'Campaign Tips',
    tips: [
      'Click on a campaign to view detailed analytics',
      'Compare variant performance in A/B tests',
      'Sort by reply rate to find top performers',
      'Export data for external analysis',
    ],
  },
  '/inbox': {
    title: 'Inbox Tips',
    tips: [
      'Filter by classification (positive, negative, etc.)',
      'Click on a reply to view the full thread',
      'Use bulk actions for efficiency',
      'Review unclassified replies periodically',
    ],
  },
  '/copy-library': {
    title: 'Copy Library Tips',
    tips: [
      'Use tags to organize and find templates',
      'Mark high-performers as templates',
      'Filter by category for quick access',
      'Add notes for context on saved variations',
    ],
  },
  '/copywriting-studio': {
    title: 'Copywriting Studio Tips',
    tips: [
      'Upload call transcripts for better personalization',
      'Review the quality score breakdown',
      'Use the sequence builder for multi-step campaigns',
      'Save successful generations to your library',
    ],
  },
  '/connections': {
    title: 'Connections Tips',
    tips: [
      'Your API key is encrypted and stored securely',
      'Sync can be triggered manually anytime',
      'Check sync status for errors',
      'Disconnect unused integrations',
    ],
  },
  '/playbook': {
    title: 'Playbook Tips',
    tips: [
      'Review best practices before writing copy',
      'Check anti-patterns to avoid common mistakes',
      'Use winning patterns in your sequences',
      'Experiment results show proven strategies',
    ],
  },
  '/audience-insights': {
    title: 'Audience Tips',
    tips: [
      'Monitor fatigue levels for segments',
      'Validate your ICP assumptions with data',
      'Check volume allocation recommendations',
      'Review segment-copy performance matrix',
    ],
  },
};

export function HelpSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isHelpOpen,
    setIsHelpOpen,
    setIsOnboardingOpen,
    steps,
    markStepCompleted,
    resetOnboarding,
    completionPercentage,
  } = useOnboarding();

  const currentPageTips = pageTips[location.pathname] || {
    title: 'Quick Tips',
    tips: ['Explore the sidebar navigation to access features'],
  };

  const handleGoToStep = (route?: string, stepId?: string) => {
    if (route) {
      if (stepId) markStepCompleted(stepId);
      setIsHelpOpen(false);
      navigate(route);
    }
  };

  const handleRestartTour = () => {
    resetOnboarding();
    setIsHelpOpen(false);
    setIsOnboardingOpen(true);
  };

  return (
    <Sheet open={isHelpOpen} onOpenChange={setIsHelpOpen}>
      <SheetContent className="w-[350px] sm:w-[400px] p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help & Getting Started
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="px-6 space-y-6">
            {/* Progress section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Onboarding Progress</span>
                <span className="text-xs text-muted-foreground">
                  {completionPercentage}% complete
                </span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
              {completionPercentage < 100 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setIsHelpOpen(false);
                    setIsOnboardingOpen(true);
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Continue Tutorial
                </Button>
              )}
            </div>

            <Separator />

            {/* Contextual tips */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">{currentPageTips.title}</span>
              </div>
              <ul className="space-y-2">
                {currentPageTips.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Circle className="h-1.5 w-1.5 mt-2 fill-current flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Quick navigation */}
            <div className="space-y-3">
              <span className="text-sm font-medium">Quick Navigation</span>
              <div className="space-y-1">
                {steps.map((step) => {
                  const Icon = stepIcons[step.id] || Circle;
                  return (
                    <button
                      key={step.id}
                      onClick={() => handleGoToStep(step.route, step.id)}
                      disabled={!step.route}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                        step.route
                          ? 'hover:bg-accent cursor-pointer'
                          : 'opacity-50 cursor-default'
                      )}
                    >
                      <div
                        className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center',
                          step.completed ? 'bg-green-500/10' : 'bg-muted'
                        )}
                      >
                        {step.completed ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{step.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {step.description}
                        </p>
                      </div>
                      {step.route && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Additional resources */}
            <div className="space-y-3">
              <span className="text-sm font-medium">Resources</span>
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleRestartTour}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restart Tutorial
                </Button>
              </div>
            </div>

            {/* Spacer for scroll */}
            <div className="h-6" />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
