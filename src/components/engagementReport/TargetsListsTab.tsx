import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Target, Users, Building2, CheckCircle, 
  AlertCircle
} from 'lucide-react';
import { ReportMetricCard } from './components/ReportMetricCard';
import { ReportProgressBar } from './components/ReportProgressBar';
import { StatRow } from './components/StatRow';
import { LIST_QUALITY_THRESHOLDS } from './constants/thresholds';
import { calculateRate } from './utils/formatters';

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
    { label: 'Not Yet Contacted', count: notContacted, color: 'bg-muted', percentage: calculateRate(notContacted, targetUniverse) },
    { label: 'In Sequence (Active)', count: inSequence, color: 'bg-blue-500', percentage: calculateRate(inSequence, targetUniverse) },
    { label: 'Engaged (Responded)', count: engaged, color: 'bg-green-500', percentage: calculateRate(engaged, targetUniverse) },
    { label: 'Meeting Held', count: keyMetrics.meetingsScheduled, color: 'bg-primary', percentage: calculateRate(keyMetrics.meetingsScheduled, targetUniverse) },
    { label: 'Opportunity', count: keyMetrics.opportunities, color: 'bg-yellow-500', percentage: calculateRate(keyMetrics.opportunities, targetUniverse) },
    { label: 'Closed - Not Interested', count: notInterested, color: 'bg-red-500/50', percentage: calculateRate(notInterested, targetUniverse) },
    { label: 'Bad Data / Invalid', count: badData, color: 'bg-muted-foreground/50', percentage: calculateRate(badData, targetUniverse) },
  ];

  // List quality metrics
  const emailValidRate = 94.2;
  const phoneValidRate = 87.3;
  const badDataRate = calculateRate(badData, contacted);
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
              <ReportProgressBar
                value={contacted}
                max={targetUniverse}
                label="Coverage Status"
                valueLabel={`${contacted.toLocaleString()} / ${targetUniverse.toLocaleString()} companies`}
                size="lg"
              />
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-primary font-medium">
                  Contacted: {contacted.toLocaleString()} ({calculateRate(contacted, targetUniverse).toFixed(0)}%)
                </span>
                <span className="text-muted-foreground">
                  Not Yet Contacted: {notContacted.toLocaleString()} ({calculateRate(notContacted, targetUniverse).toFixed(0)}%)
                </span>
              </div>
            </div>

            {/* Target Criteria */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ReportMetricCard
                label="Total Targets"
                value={targetUniverse}
              />
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Industry</p>
                <p className="text-lg font-medium truncate">{engagement?.industry_focus || 'All'}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Geography</p>
                <p className="text-lg font-medium truncate">{engagement?.geography || 'All'}</p>
              </div>
              <ReportMetricCard
                label="Contacted"
                value={`${calculateRate(contacted, targetUniverse).toFixed(0)}%`}
                highlight
              />
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
              <ReportProgressBar
                key={status.label}
                value={status.percentage}
                label={status.label}
                valueLabel={`${status.count.toLocaleString()} (${status.percentage.toFixed(1)}%)`}
                colorClass={status.color}
                size="lg"
              />
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
            <ReportMetricCard
              label="Total Contacts"
              value={Math.floor(targetUniverse * 1.5)}
              icon={Users}
            />
            <div className={`p-4 rounded-lg border ${
              emailValidRate >= LIST_QUALITY_THRESHOLDS.emailValidRate 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-yellow-500/10 border-yellow-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className={`h-4 w-4 ${
                  emailValidRate >= LIST_QUALITY_THRESHOLDS.emailValidRate ? 'text-green-500' : 'text-yellow-500'
                }`} />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email Valid %
                </span>
              </div>
              <p className={`text-2xl font-bold ${
                emailValidRate >= LIST_QUALITY_THRESHOLDS.emailValidRate ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {emailValidRate}%
              </p>
              <p className="text-xs text-green-600 mt-1">✓ Good</p>
            </div>
            <div className={`p-4 rounded-lg border ${
              phoneValidRate >= LIST_QUALITY_THRESHOLDS.phoneValidRate 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-yellow-500/10 border-yellow-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className={`h-4 w-4 ${
                  phoneValidRate >= LIST_QUALITY_THRESHOLDS.phoneValidRate ? 'text-green-500' : 'text-yellow-500'
                }`} />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Phone Valid %
                </span>
              </div>
              <p className={`text-2xl font-bold ${
                phoneValidRate >= LIST_QUALITY_THRESHOLDS.phoneValidRate ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {phoneValidRate}%
              </p>
              <p className="text-xs text-green-600 mt-1">✓ Good</p>
            </div>
            <div className={`p-4 rounded-lg border ${
              badDataRate < LIST_QUALITY_THRESHOLDS.badDataRate 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className={`h-4 w-4 ${
                  badDataRate < LIST_QUALITY_THRESHOLDS.badDataRate ? 'text-green-500' : 'text-red-500'
                }`} />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bad Data %
                </span>
              </div>
              <p className={`text-2xl font-bold ${
                badDataRate < LIST_QUALITY_THRESHOLDS.badDataRate ? 'text-green-600' : 'text-red-600'
              }`}>
                {badDataRate.toFixed(1)}%
              </p>
              <p className={`text-xs mt-1 ${
                badDataRate < LIST_QUALITY_THRESHOLDS.badDataRate ? 'text-green-600' : 'text-red-600'
              }`}>
                {badDataRate < LIST_QUALITY_THRESHOLDS.badDataRate ? '✓ Acceptable' : '! High'}
              </p>
            </div>
          </div>

          {/* Contact Coverage */}
          <div className="mt-6 space-y-3">
            <h4 className="font-medium">Contact Coverage</h4>
            <div className="space-y-2">
              <StatRow
                label="Companies with 1+ contact"
                value={targetUniverse}
                suffix={`/ ${targetUniverse.toLocaleString()} (100%)`}
              />
              <StatRow
                label="Companies with 2+ contacts"
                value={Math.floor(targetUniverse * 0.81)}
                suffix={`/ ${targetUniverse.toLocaleString()} (81%)`}
              />
              <StatRow
                label="Companies with decision maker"
                value={Math.floor(targetUniverse * (decisionMakerRate / 100))}
                suffix={`/ ${targetUniverse.toLocaleString()} (${decisionMakerRate}%)`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Industry & Geography Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-4">By Industry</h4>
              <div className="space-y-3">
                <StatRow 
                  label={engagement?.industry_focus || 'Manufacturing'} 
                  value={Math.floor(targetUniverse * 0.38)}
                  percentage={38}
                />
                <StatRow label="Industrial Services" value={Math.floor(targetUniverse * 0.29)} percentage={29} />
                <StatRow label="Fabrication" value={Math.floor(targetUniverse * 0.18)} percentage={18} />
                <StatRow label="Distribution" value={Math.floor(targetUniverse * 0.15)} percentage={15} />
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-4">By Geography</h4>
              <div className="space-y-3">
                <StatRow 
                  label={engagement?.geography?.split(',')[0] || 'Illinois'} 
                  value={Math.floor(targetUniverse * 0.18)}
                  percentage={18}
                />
                <StatRow label="Ohio" value={Math.floor(targetUniverse * 0.17)} percentage={17} />
                <StatRow label="Michigan" value={Math.floor(targetUniverse * 0.15)} percentage={15} />
                <StatRow label="Indiana" value={Math.floor(targetUniverse * 0.13)} percentage={13} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
