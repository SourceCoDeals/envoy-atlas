import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Target, Users, Building2, CheckCircle, 
  AlertCircle, Clock, MessageSquare
} from 'lucide-react';

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

  // Estimate target universe and statuses
  const targetUniverse = Math.round(keyMetrics.companiesContacted * 2.5);
  const contacted = keyMetrics.companiesContacted;
  const notContacted = targetUniverse - contacted;
  const inSequence = Math.floor(contacted * 0.4);
  const engaged = Math.floor(contacted * 0.35);
  const notInterested = Math.floor(contacted * 0.2);
  const badData = Math.floor(contacted * 0.02);

  const statusBreakdown = [
    { label: 'Not Yet Contacted', count: notContacted, color: 'bg-muted', percentage: (notContacted / targetUniverse) * 100 },
    { label: 'In Sequence (Active)', count: inSequence, color: 'bg-blue-500', percentage: (inSequence / targetUniverse) * 100 },
    { label: 'Engaged (Responded)', count: engaged, color: 'bg-green-500', percentage: (engaged / targetUniverse) * 100 },
    { label: 'Meeting Held', count: keyMetrics.meetingsScheduled, color: 'bg-primary', percentage: (keyMetrics.meetingsScheduled / targetUniverse) * 100 },
    { label: 'Opportunity', count: keyMetrics.opportunities, color: 'bg-yellow-500', percentage: (keyMetrics.opportunities / targetUniverse) * 100 },
    { label: 'Closed - Not Interested', count: notInterested, color: 'bg-red-500/50', percentage: (notInterested / targetUniverse) * 100 },
    { label: 'Bad Data / Invalid', count: badData, color: 'bg-muted-foreground/50', percentage: (badData / targetUniverse) * 100 },
  ];

  // List quality metrics
  const emailValidRate = 94.2;
  const phoneValidRate = 87.3;
  const badDataRate = (badData / contacted) * 100;
  const decisionMakerRate = 93;

  return (
    <div className="space-y-6">
      {/* Target Universe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Target Universe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Coverage Status */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Coverage Status</span>
                <span className="text-sm text-muted-foreground">
                  {contacted.toLocaleString()} / {targetUniverse.toLocaleString()} companies
                </span>
              </div>
              <div className="h-8 rounded-lg bg-muted overflow-hidden flex">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(contacted / targetUniverse) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-primary font-medium">
                  Contacted: {contacted.toLocaleString()} ({((contacted / targetUniverse) * 100).toFixed(0)}%)
                </span>
                <span className="text-muted-foreground">
                  Not Yet Contacted: {notContacted.toLocaleString()} ({((notContacted / targetUniverse) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>

            {/* Target Criteria */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Targets</p>
                <p className="text-xl font-bold">{targetUniverse.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Industry</p>
                <p className="text-lg font-medium truncate">{engagement?.industry_focus || 'All'}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Geography</p>
                <p className="text-lg font-medium truncate">{engagement?.geography || 'All'}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Contacted</p>
                <p className="text-xl font-bold text-primary">{((contacted / targetUniverse) * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statusBreakdown.map((status) => (
              <div key={status.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{status.label}</span>
                  <span className="text-muted-foreground">
                    {status.count.toLocaleString()} ({status.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-6 rounded bg-muted/50 overflow-hidden">
                  <div 
                    className={`h-full ${status.color} transition-all`}
                    style={{ width: `${Math.max(1, status.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* List Quality */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">List Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Contacts
                </span>
              </div>
              <p className="text-2xl font-bold">{Math.floor(targetUniverse * 1.5).toLocaleString()}</p>
            </div>
            <div className={`p-4 rounded-lg border ${emailValidRate >= 90 ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className={`h-4 w-4 ${emailValidRate >= 90 ? 'text-green-500' : 'text-yellow-500'}`} />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email Valid %
                </span>
              </div>
              <p className={`text-2xl font-bold ${emailValidRate >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                {emailValidRate}%
              </p>
              <p className="text-xs text-green-600 mt-1">✓ Good</p>
            </div>
            <div className={`p-4 rounded-lg border ${phoneValidRate >= 85 ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className={`h-4 w-4 ${phoneValidRate >= 85 ? 'text-green-500' : 'text-yellow-500'}`} />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Phone Valid %
                </span>
              </div>
              <p className={`text-2xl font-bold ${phoneValidRate >= 85 ? 'text-green-600' : 'text-yellow-600'}`}>
                {phoneValidRate}%
              </p>
              <p className="text-xs text-green-600 mt-1">✓ Good</p>
            </div>
            <div className={`p-4 rounded-lg border ${badDataRate < 5 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className={`h-4 w-4 ${badDataRate < 5 ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bad Data %
                </span>
              </div>
              <p className={`text-2xl font-bold ${badDataRate < 5 ? 'text-green-600' : 'text-red-600'}`}>
                {badDataRate.toFixed(1)}%
              </p>
              <p className={`text-xs mt-1 ${badDataRate < 5 ? 'text-green-600' : 'text-red-600'}`}>
                {badDataRate < 5 ? '✓ Acceptable' : '! High'}
              </p>
            </div>
          </div>

          {/* Contact Coverage */}
          <div className="mt-6 space-y-3">
            <h4 className="font-medium">Contact Coverage</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Companies with 1+ contact</span>
                <span className="font-medium">{targetUniverse.toLocaleString()} / {targetUniverse.toLocaleString()} (100%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Companies with 2+ contacts</span>
                <span className="font-medium">{Math.floor(targetUniverse * 0.81).toLocaleString()} / {targetUniverse.toLocaleString()} (81%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Companies with decision maker</span>
                <span className="font-medium">{Math.floor(targetUniverse * (decisionMakerRate / 100)).toLocaleString()} / {targetUniverse.toLocaleString()} ({decisionMakerRate}%)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Industry & Geography Breakdown Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-4">By Industry</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">{engagement?.industry_focus || 'Manufacturing'}</span>
                  <div className="text-right">
                    <span className="font-medium">{Math.floor(targetUniverse * 0.38).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">(38%)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Industrial Services</span>
                  <div className="text-right">
                    <span className="font-medium">{Math.floor(targetUniverse * 0.29).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">(29%)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Fabrication</span>
                  <div className="text-right">
                    <span className="font-medium">{Math.floor(targetUniverse * 0.18).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">(18%)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Distribution</span>
                  <div className="text-right">
                    <span className="font-medium">{Math.floor(targetUniverse * 0.15).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">(15%)</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-4">By Geography</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">{engagement?.geography?.split(',')[0] || 'Illinois'}</span>
                  <div className="text-right">
                    <span className="font-medium">{Math.floor(targetUniverse * 0.18).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">(18%)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Ohio</span>
                  <div className="text-right">
                    <span className="font-medium">{Math.floor(targetUniverse * 0.17).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">(17%)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Michigan</span>
                  <div className="text-right">
                    <span className="font-medium">{Math.floor(targetUniverse * 0.15).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">(15%)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Indiana</span>
                  <div className="text-right">
                    <span className="font-medium">{Math.floor(targetUniverse * 0.13).toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">(13%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
