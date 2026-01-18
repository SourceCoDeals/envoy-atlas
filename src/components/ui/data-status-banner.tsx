import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  Settings,
  ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export type DataStatusType = 'healthy' | 'partial' | 'broken' | 'not-configured';

interface DataStatusBannerProps {
  status: DataStatusType;
  title: string;
  description: string;
  issues?: string[];
  configureLink?: string;
  configureLinkLabel?: string;
  className?: string;
}

const statusConfig: Record<DataStatusType, {
  icon: typeof AlertTriangle;
  variant: 'default' | 'destructive';
  iconClassName: string;
  bgClassName: string;
}> = {
  healthy: {
    icon: CheckCircle,
    variant: 'default',
    iconClassName: 'text-green-500',
    bgClassName: 'border-green-500/30 bg-green-500/5',
  },
  partial: {
    icon: AlertTriangle,
    variant: 'default',
    iconClassName: 'text-yellow-500',
    bgClassName: 'border-yellow-500/30 bg-yellow-500/5',
  },
  broken: {
    icon: XCircle,
    variant: 'destructive',
    iconClassName: 'text-red-500',
    bgClassName: 'border-red-500/30 bg-red-500/5',
  },
  'not-configured': {
    icon: Settings,
    variant: 'default',
    iconClassName: 'text-muted-foreground',
    bgClassName: 'border-muted bg-muted/20',
  },
};

export function DataStatusBanner({
  status,
  title,
  description,
  issues,
  configureLink,
  configureLinkLabel = 'Configure',
  className,
}: DataStatusBannerProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Alert className={cn(config.bgClassName, className)}>
      <Icon className={cn('h-5 w-5', config.iconClassName)} />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        
        {issues && issues.length > 0 && (
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}
        
        {configureLink && (
          <Button variant="outline" size="sm" asChild>
            <Link to={configureLink}>
              {configureLinkLabel}
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Pre-configured banners for common scenarios
export function MeetingTrackingNotConfigured() {
  return (
    <DataStatusBanner
      status="not-configured"
      title="Meeting Tracking Not Configured"
      description="This section requires meeting tracking to display accurate data. Currently showing placeholder values."
      issues={[
        'Meeting breakdown (completed/scheduled/cancelled) is hardcoded',
        'Channel attribution is estimated using fixed ratios',
        'Opportunity stages are not tracked',
      ]}
      configureLink="/settings"
      configureLinkLabel="Configure Integrations"
    />
  );
}

export function TargetListNotConfigured() {
  return (
    <DataStatusBanner
      status="not-configured"
      title="Target List Tracking Not Available"
      description="This section requires target list data to be uploaded or synced from a CRM. Currently showing derived estimates."
      issues={[
        'Target universe is estimated (companies contacted × 2.5)',
        'Contact statuses are derived from engagement data',
        'Email/phone validity rates are not verified',
        'Industry and geography breakdowns are placeholders',
      ]}
      configureLink="/settings"
      configureLinkLabel="Upload Target List"
    />
  );
}

export function SentimentAnalysisNotAvailable() {
  return (
    <DataStatusBanner
      status="partial"
      title="Full Sentiment Analysis Not Available"
      description="Only positive replies are tracked. Neutral and negative sentiment breakdown requires AI classification which is not configured."
      issues={[
        'Neutral replies are estimated as 20% of total replies',
        'Negative replies are calculated as remainder',
      ]}
    />
  );
}
