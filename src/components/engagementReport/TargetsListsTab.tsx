import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Target, AlertTriangle, Database
} from 'lucide-react';
import { TargetListNotConfigured } from '@/components/ui/data-status-banner';
import { DataErrorFlag } from '@/components/ui/data-error-flag';

interface TargetsListsTabProps {
  data: {
    keyMetrics: {
      companiesContacted: number;
      positiveResponses: number;
      meetingsScheduled: number;
      opportunities: number;
    };
    engagement: {
      industry_focus: string | null;
      geography: string | null;
    } | null;
  };
}

export function TargetsListsTab({ data }: TargetsListsTabProps) {
  const { keyMetrics, engagement } = data;

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <TargetListNotConfigured />

      {/* Actual Data We Have */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Available Data from Outreach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-green-500/10 border-green-500/20">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Companies Contacted</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{keyMetrics.companiesContacted.toLocaleString()}</p>
              <p className="text-xs text-green-600 mt-1">✓ From outreach data</p>
            </Card>
            
            <Card className="p-4 bg-green-500/10 border-green-500/20">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Positive Responses</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{keyMetrics.positiveResponses}</p>
              <p className="text-xs text-green-600 mt-1">✓ Tracked</p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Meetings</p>
                <DataErrorFlag type="estimated" size="sm" />
              </div>
              <p className="text-3xl font-bold mt-1">{keyMetrics.meetingsScheduled}</p>
              <p className="text-xs text-muted-foreground mt-1">Includes estimates</p>
            </Card>
            
            <div className="p-4 rounded-lg border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Industry Focus</p>
              <p className="text-lg font-medium mt-1 truncate">{engagement?.industry_focus || 'Not specified'}</p>
              <p className="text-xs text-muted-foreground mt-1">From engagement config</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Not Tracked Section */}
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            Data Not Being Tracked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">Target Universe</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Total Target Companies</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Not Yet Contacted</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>In Sequence (Active)</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires target list upload or CRM integration.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">Contact Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Engaged (Responded)</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Not Interested</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Bad Data / Invalid</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires sequence step tracking and response classification.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">List Quality Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Email Validity Rate</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Phone Validity Rate</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Decision Maker %</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires email verification and contact enrichment.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">Breakdown Analysis</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>By Industry</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>By Geography</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>By Company Size</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires enriched lead data with firmographics.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
