import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  RefreshCw, 
  Plug, 
  Sparkles, 
  ListOrdered,
  BarChart3,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type EmptyStateType = 
  | 'no-data' 
  | 'no-patterns' 
  | 'no-sequences' 
  | 'needs-sync' 
  | 'needs-backfill'
  | 'low-confidence';

interface ActionableEmptyStateProps {
  type: EmptyStateType;
  className?: string;
  onAction?: () => void;
  isLoading?: boolean;
}

const emptyStateConfig: Record<EmptyStateType, {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionType?: 'button' | 'link';
  actionHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}> = {
  'no-data': {
    icon: <FileText className="h-10 w-10" />,
    title: 'No Copy Data Yet',
    description: 'Connect your email platform to analyze subject lines and body copy performance. We\'ll show you what\'s working and what to improve.',
    actionLabel: 'Connect Data Source',
    actionType: 'link',
    actionHref: '/connections',
  },
  'no-patterns': {
    icon: <BarChart3 className="h-10 w-10" />,
    title: 'No Patterns Found Yet',
    description: 'We need more data to identify statistically significant patterns. Either sync more campaigns or run the pattern analysis with lower thresholds.',
    actionLabel: 'Run Pattern Analysis',
    actionType: 'button',
    secondaryLabel: 'Sync More Data',
    secondaryHref: '/connections',
  },
  'no-sequences': {
    icon: <ListOrdered className="h-10 w-10" />,
    title: 'No Sequence Data Available',
    description: 'Sequence analytics require step-level tracking from your email platform. Make sure your campaigns have multi-step sequences configured.',
    actionLabel: 'Re-sync Campaigns',
    actionType: 'button',
    secondaryLabel: 'View Campaigns',
    secondaryHref: '/campaigns',
  },
  'needs-sync': {
    icon: <Plug className="h-10 w-10" />,
    title: 'Data Needs Refreshing',
    description: 'Your data might be out of date. Sync your connected platforms to get the latest campaign performance data.',
    actionLabel: 'Sync Now',
    actionType: 'button',
    secondaryLabel: 'Check Connections',
    secondaryHref: '/settings',
  },
  'needs-backfill': {
    icon: <Sparkles className="h-10 w-10" />,
    title: 'Feature Extraction Needed',
    description: 'We found variants but haven\'t analyzed them yet. Run the backfill to extract subject line features, CTA types, and generate AI recommendations.',
    actionLabel: 'Backfill & Analyze',
    actionType: 'button',
  },
  'low-confidence': {
    icon: <RefreshCw className="h-10 w-10" />,
    title: 'Low Confidence Results',
    description: 'Your sample sizes are small, so results may not be reliable. Send more emails or combine data from multiple campaigns for better insights.',
    actionLabel: 'View Anyway',
    actionType: 'button',
    secondaryLabel: 'Learn About Confidence',
    secondaryHref: '#',
  },
};

export function ActionableEmptyState({ 
  type, 
  className, 
  onAction, 
  isLoading = false 
}: ActionableEmptyStateProps) {
  const config = emptyStateConfig[type];

  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
          {config.icon}
        </div>
        <h2 className="text-xl font-semibold mb-2 text-center">{config.title}</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          {config.description}
        </p>
        <div className="flex gap-3">
          {config.actionLabel && config.actionType === 'link' && config.actionHref && (
            <Button asChild>
              <Link to={config.actionHref}>
                {config.actionLabel}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
          {config.actionLabel && config.actionType === 'button' && (
            <Button onClick={onAction} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {config.actionLabel}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}
          {config.secondaryLabel && config.secondaryHref && (
            <Button variant="outline" asChild>
              <Link to={config.secondaryHref}>{config.secondaryLabel}</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Quick use components for specific scenarios
export function NoDataEmptyState({ className }: { className?: string }) {
  return <ActionableEmptyState type="no-data" className={className} />;
}

export function NoPatternsEmptyState({ 
  className, 
  onRecompute, 
  isLoading 
}: { 
  className?: string; 
  onRecompute?: () => void;
  isLoading?: boolean;
}) {
  return (
    <ActionableEmptyState 
      type="no-patterns" 
      className={className} 
      onAction={onRecompute}
      isLoading={isLoading}
    />
  );
}

export function NoSequencesEmptyState({ 
  className, 
  onResync, 
  isLoading 
}: { 
  className?: string; 
  onResync?: () => void;
  isLoading?: boolean;
}) {
  return (
    <ActionableEmptyState 
      type="no-sequences" 
      className={className} 
      onAction={onResync}
      isLoading={isLoading}
    />
  );
}
