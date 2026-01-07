import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  route?: string;
  completed: boolean;
}

interface OnboardingContextType {
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  steps: OnboardingStep[];
  markStepCompleted: (stepId: string) => void;
  resetOnboarding: () => void;
  hasCompletedOnboarding: boolean;
  completionPercentage: number;
}

const ONBOARDING_STORAGE_KEY = 'envoy-atlas-onboarding';

const defaultSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Analytics',
    description: 'Get started with your outreach analytics platform',
    completed: false,
  },
  {
    id: 'connect-data',
    title: 'Connect Your Data',
    description: 'Connect Smartlead or other platforms to sync your campaign data',
    route: '/connections',
    completed: false,
  },
  {
    id: 'review-campaigns',
    title: 'Review Campaigns',
    description: 'View your synced campaigns and their performance metrics',
    route: '/campaigns',
    completed: false,
  },
  {
    id: 'audience-insights',
    title: 'Explore Audience Insights',
    description: 'Understand your audience segments and their engagement patterns',
    route: '/audience-insights',
    completed: false,
  },
  {
    id: 'copy-library',
    title: 'Browse Copy Library',
    description: 'Access your saved templates and high-performing copy variations',
    route: '/copy-library',
    completed: false,
  },
  {
    id: 'copywriting-studio',
    title: 'Create with AI',
    description: 'Use the Copywriting Studio to generate optimized outreach sequences',
    route: '/copywriting-studio',
    completed: false,
  },
  {
    id: 'inbox',
    title: 'Manage Your Inbox',
    description: 'Review and respond to replies, track conversations',
    route: '/inbox',
    completed: false,
  },
  {
    id: 'playbook',
    title: 'Learn Best Practices',
    description: 'Explore proven patterns and strategies in the Playbook',
    route: '/playbook',
    completed: false,
  },
];

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>(defaultSteps);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSteps(parsed.steps || defaultSteps);
        setCurrentStep(parsed.currentStep || 0);
      } catch {
        // Invalid data, use defaults
      }
    } else {
      // First time user - show onboarding after a short delay
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ steps, currentStep })
    );
  }, [steps, currentStep]);

  const markStepCompleted = (stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, completed: true } : step
      )
    );
  };

  const resetOnboarding = () => {
    setSteps(defaultSteps);
    setCurrentStep(0);
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  };

  const completedCount = steps.filter((s) => s.completed).length;
  const completionPercentage = Math.round((completedCount / steps.length) * 100);
  const hasCompletedOnboarding = completionPercentage === 100;

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingOpen,
        setIsOnboardingOpen,
        isHelpOpen,
        setIsHelpOpen,
        currentStep,
        setCurrentStep,
        steps,
        markStepCompleted,
        resetOnboarding,
        hasCompletedOnboarding,
        completionPercentage,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
