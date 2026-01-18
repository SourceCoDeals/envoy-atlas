import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataHealth, type DataSourceHealth, type DataHealthStatus } from '@/hooks/useDataHealth';
import { DataHealthIndicator } from '@/components/ui/data-health-indicator';
import { 
  Mail, 
  Phone, 
  FileText, 
  Users, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DataSourceRowProps {
  source: DataSourceHealth;
  icon?: React.ReactNode;
}

function DataSourceRow({ source, icon }: DataSourceRowProps) {
  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg border',
      source.status === 'healthy' && 'bg-green-500/5 border-green-500/20',
      source.status === 'degraded' && 'bg-yellow-500/5 border-yellow-500/20',
      source.status === 'broken' && 'bg-red-500/5 border-red-500/20',
      source.status === 'empty' && 'bg-muted/50 border-border',
    )}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="font-medium text-sm">{source.name}</p>
          <p className="text-xs text-muted-foreground">{source.details}</p>
        </div>
      </div>
      <DataHealthIndicator 
        status={source.status} 
        size="sm"
        showLabel={false}
        tooltip={source.details}
      />
    </div>
  );
}

function SectionCard({ 
  title, 
  description, 
  icon, 
  sources,
  overallStatus,
}: { 
  title: string; 
  description: string;
  icon: React.ReactNode;
  sources: DataSourceHealth[];
  overallStatus: DataHealthStatus;
}) {
  const healthyCount = sources.filter(s => s.status === 'healthy').length;
  
  return (
    <Card className={cn(
      'border-l-4',
      overallStatus === 'healthy' && 'border-l-green-500',
      overallStatus === 'degraded' && 'border-l-yellow-500',
      overallStatus === 'broken' && 'border-l-red-500',
      overallStatus === 'empty' && 'border-l-muted-foreground',
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge variant={overallStatus === 'healthy' ? 'default' : overallStatus === 'degraded' ? 'secondary' : 'destructive'}>
            {healthyCount}/{sources.length} working
          </Badge>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((source) => (
          <DataSourceRow key={source.table} source={source} />
        ))}
      </CardContent>
    </Card>
  );
}

export function DataHealthDashboard() {
  const { health, loading, error, refetch } = useDataHealth();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6 text-center">
          <XCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
          <p className="text-sm text-destructive">{error || 'Failed to load data health'}</p>
          <Button variant="outline" size="sm" onClick={refetch} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getOverallStatusIcon = () => {
    switch (health.overall.status) {
      case 'healthy': return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      case 'broken': return <XCircle className="h-6 w-6 text-red-500" />;
      default: return <Settings className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getSectionStatus = (sources: DataSourceHealth[]): DataHealthStatus => {
    const healthyCount = sources.filter(s => s.status === 'healthy').length;
    const hasData = sources.some(s => s.hasData);
    if (healthyCount === sources.length) return 'healthy';
    if (healthyCount > 0) return 'degraded';
    if (hasData) return 'broken';
    return 'empty';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getOverallStatusIcon()}
            <div>
              <CardTitle>Data Health Status</CardTitle>
              <CardDescription>
                {health.overall.healthyCount} of {health.overall.totalCount} data sources working
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/connections">
                <Settings className="h-4 w-4 mr-2" />
                Connections
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            title="Email Platforms"
            description="Campaign and metrics data"
            icon={<Mail className="h-4 w-4 text-muted-foreground" />}
            sources={[health.email.smartlead, health.email.replyio]}
            overallStatus={getSectionStatus([health.email.smartlead, health.email.replyio])}
          />
          <SectionCard
            title="Calling Data"
            description="Call logs and recordings"
            icon={<Phone className="h-4 w-4 text-muted-foreground" />}
            sources={[health.calling.phoneburner, health.calling.coldCalls]}
            overallStatus={getSectionStatus([health.calling.phoneburner, health.calling.coldCalls])}
          />
          <SectionCard
            title="Copy Insights"
            description="Variants and patterns"
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            sources={[health.insights.copyVariants, health.insights.copyLibrary, health.insights.patterns]}
            overallStatus={getSectionStatus([health.insights.copyVariants, health.insights.copyLibrary, health.insights.patterns])}
          />
          <SectionCard
            title="Pipeline"
            description="Leads, deals, and engagements"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            sources={[health.pipeline.leads, health.pipeline.deals, health.pipeline.engagements]}
            overallStatus={getSectionStatus([health.pipeline.leads, health.pipeline.deals, health.pipeline.engagements])}
          />
        </div>
      </CardContent>
    </Card>
  );
}
