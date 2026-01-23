import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, AlertCircle, XCircle, Clock, 
  Mail, Phone, Calendar, Users, Globe, FileText,
  RefreshCw, Wand2
} from 'lucide-react';
import type { LinkedCampaignWithStats, EmailMetrics, CallingMetrics, InfrastructureMetrics } from '@/hooks/useEngagementReport';

type DataStatus = 'available' | 'partial' | 'missing' | 'pending';

interface DataSource {
  name: string;
  icon: typeof Mail;
  status: DataStatus;
  detail: string;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
}

interface DataAvailabilitySummaryProps {
  linkedCampaigns: LinkedCampaignWithStats[];
  emailMetrics: EmailMetrics;
  callingMetrics?: CallingMetrics;
  infrastructureMetrics?: InfrastructureMetrics;
  hasWeeklyPerformance: boolean;
  hasEnrollmentData: boolean;
  hasContacts: boolean;
  hasVariants: boolean;
  onGenerateBreakdown?: () => void;
  onClassifyReplies?: () => void;
  isGeneratingBreakdown?: boolean;
  isClassifying?: boolean;
}

export function DataAvailabilitySummary({
  linkedCampaigns,
  emailMetrics,
  callingMetrics,
  infrastructureMetrics,
  hasWeeklyPerformance,
  hasEnrollmentData,
  hasContacts,
  hasVariants,
  onGenerateBreakdown,
  onClassifyReplies,
  isGeneratingBreakdown,
  isClassifying,
}: DataAvailabilitySummaryProps) {
  
  const getStatus = (condition: boolean, hasPartial?: boolean): DataStatus => {
    if (condition) return 'available';
    if (hasPartial) return 'partial';
    return 'missing';
  };

  const dataSources: DataSource[] = [
    {
      name: 'Campaigns',
      icon: Mail,
      status: getStatus(linkedCampaigns.length > 0),
      detail: linkedCampaigns.length > 0 
        ? `${linkedCampaigns.length} linked (${emailMetrics.sent.toLocaleString()} sent)`
        : 'No campaigns linked',
    },
    {
      name: 'Weekly Metrics',
      icon: Calendar,
      status: getStatus(hasWeeklyPerformance, emailMetrics.sent > 0),
      detail: hasWeeklyPerformance 
        ? 'Weekly breakdown available'
        : emailMetrics.sent > 0 ? 'Can be generated from totals' : 'No data to generate',
      action: !hasWeeklyPerformance && emailMetrics.sent > 0 && onGenerateBreakdown ? {
        label: 'Generate',
        onClick: onGenerateBreakdown,
        loading: isGeneratingBreakdown,
      } : undefined,
    },
    {
      name: 'Reply Classification',
      icon: FileText,
      status: getStatus(emailMetrics.positiveReplies > 0, emailMetrics.replied > 0),
      detail: emailMetrics.positiveReplies > 0 
        ? `${emailMetrics.positiveReplies} positive of ${emailMetrics.replied} replies`
        : emailMetrics.replied > 0 ? 'Replies not yet classified' : 'No replies to classify',
      action: emailMetrics.replied > 0 && emailMetrics.positiveReplies === 0 && onClassifyReplies ? {
        label: 'Classify',
        onClick: onClassifyReplies,
        loading: isClassifying,
      } : undefined,
    },
    {
      name: 'Enrollment',
      icon: Users,
      status: getStatus(hasEnrollmentData),
      detail: hasEnrollmentData 
        ? 'Lead enrollment tracked'
        : 'No enrollment data synced',
    },
    {
      name: 'Contacts',
      icon: Users,
      status: getStatus(hasContacts),
      detail: hasContacts
        ? 'Contact records available'
        : 'No contacts synced yet',
    },
    {
      name: 'Infrastructure',
      icon: Globe,
      status: getStatus(
        (infrastructureMetrics?.totalMailboxes ?? 0) > 0
      ),
      detail: infrastructureMetrics && infrastructureMetrics.totalMailboxes > 0
        ? `${infrastructureMetrics.totalMailboxes} mailboxes, ${infrastructureMetrics.totalDomains} domains`
        : 'No infrastructure data synced',
    },
    {
      name: 'Variants',
      icon: FileText,
      status: getStatus(hasVariants),
      detail: hasVariants
        ? 'Sequence variants available'
        : 'No variant data synced',
    },
    {
      name: 'Calling',
      icon: Phone,
      status: getStatus(
        callingMetrics !== undefined && callingMetrics.totalCalls > 0
      ),
      detail: callingMetrics && callingMetrics.totalCalls > 0
        ? `${callingMetrics.totalCalls} calls tracked`
        : 'No calling integration connected',
    },
  ];

  const statusConfig: Record<DataStatus, { icon: typeof CheckCircle; className: string; label: string }> = {
    available: { icon: CheckCircle, className: 'text-success', label: 'Available' },
    partial: { icon: AlertCircle, className: 'text-warning', label: 'Partial' },
    missing: { icon: XCircle, className: 'text-muted-foreground', label: 'Missing' },
    pending: { icon: Clock, className: 'text-primary', label: 'Pending' },
  };

  const availableCount = dataSources.filter(d => d.status === 'available').length;
  const totalCount = dataSources.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Data Availability
            <Badge variant="outline" className="ml-2">
              {availableCount}/{totalCount}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dataSources.map((source) => {
            const StatusIcon = statusConfig[source.status].icon;
            const SourceIcon = source.icon;
            
            return (
              <div 
                key={source.name}
                className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <SourceIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{source.name}</span>
                  </div>
                  <StatusIcon className={`h-4 w-4 ${statusConfig[source.status].className}`} />
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {source.detail}
                </p>
                {source.action && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full h-7 text-xs"
                    onClick={source.action.onClick}
                    disabled={source.action.loading}
                  >
                    {source.action.loading ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3 mr-1" />
                    )}
                    {source.action.label}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
