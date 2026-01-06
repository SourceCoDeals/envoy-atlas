import { Card, CardContent } from '@/components/ui/card';
import { FlaskConical, Trophy, XCircle, FileText, AlertTriangle } from 'lucide-react';

interface ExperimentStatusOverviewProps {
  running: number;
  winners: number;
  noDiff: number;
  draft: number;
  onFilterChange?: (filter: string | null) => void;
  activeFilter?: string | null;
}

export function ExperimentStatusOverview({ 
  running, 
  winners, 
  noDiff, 
  draft,
  onFilterChange,
  activeFilter 
}: ExperimentStatusOverviewProps) {
  const total = running + winners + noDiff + draft;
  const winnerRate = total > 0 ? (winners / total) * 100 : 0;
  const hasHealthIssue = total >= 10 && winnerRate < 15;

  const statuses = [
    {
      key: 'running',
      icon: FlaskConical,
      label: 'RUNNING',
      count: running,
      description: 'Active tests',
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
      borderClass: 'border-primary/30'
    },
    {
      key: 'winners',
      icon: Trophy,
      label: 'WINNERS',
      count: winners,
      description: `${winnerRate.toFixed(0)}% win rate`,
      colorClass: winners > 0 ? 'text-success' : 'text-muted-foreground',
      bgClass: winners > 0 ? 'bg-success/10' : 'bg-muted',
      borderClass: winners > 0 ? 'border-success/30' : 'border-border'
    },
    {
      key: 'noDiff',
      icon: XCircle,
      label: 'NO DIFF',
      count: noDiff,
      description: 'Inconclusive',
      colorClass: 'text-muted-foreground',
      bgClass: 'bg-muted',
      borderClass: 'border-border'
    },
    {
      key: 'needs_data',
      icon: FileText,
      label: 'NEEDS DATA',
      count: draft,
      description: 'Insufficient sample',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/30'
    }
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">EXPERIMENT STATUS</h3>
          {hasHealthIssue && (
            <div className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="h-3 w-3" />
              <span>Low winner rate may indicate underpowered tests</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statuses.map(({ key, icon: Icon, label, count, description, colorClass, bgClass, borderClass }) => (
            <button
              key={key}
              onClick={() => onFilterChange?.(activeFilter === key ? null : key)}
              className={`rounded-lg border p-4 ${bgClass} ${borderClass} transition-all hover:scale-[1.02] text-left ${
                activeFilter === key ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${colorClass}`} />
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
              <p className={`text-3xl font-bold ${colorClass}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
