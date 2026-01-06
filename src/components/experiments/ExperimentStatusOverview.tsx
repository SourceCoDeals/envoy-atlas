import { Card, CardContent } from '@/components/ui/card';
import { FlaskConical, Trophy, XCircle, FileText } from 'lucide-react';

interface ExperimentStatusOverviewProps {
  running: number;
  winners: number;
  noDiff: number;
  draft: number;
}

export function ExperimentStatusOverview({ running, winners, noDiff, draft }: ExperimentStatusOverviewProps) {
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
      description: 'This year',
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
      borderClass: 'border-success/30'
    },
    {
      key: 'noDiff',
      icon: XCircle,
      label: 'NO DIFF',
      count: noDiff,
      description: 'This year',
      colorClass: 'text-muted-foreground',
      bgClass: 'bg-muted',
      borderClass: 'border-border'
    },
    {
      key: 'draft',
      icon: FileText,
      label: 'DRAFT',
      count: draft,
      description: 'Ready to launch',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/30'
    }
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">EXPERIMENT STATUS</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statuses.map(({ key, icon: Icon, label, count, description, colorClass, bgClass, borderClass }) => (
            <div
              key={key}
              className={`rounded-lg border p-4 ${bgClass} ${borderClass} transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${colorClass}`} />
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
              <p className={`text-3xl font-bold ${colorClass}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
