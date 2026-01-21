import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { BarChart3, CheckCircle, XCircle } from 'lucide-react';
import type { ObjectionAnalytics } from '@/hooks/useCallObjections';
import { getObjectionTypeInfo } from '@/hooks/useCallObjections';

interface Props {
  data: ObjectionAnalytics;
  isLoading?: boolean;
}

// Use semantic design tokens
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--foreground))',
];

export function ObjectionDistributionChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading objection data...
        </CardContent>
      </Card>
    );
  }

  if (!data.byType.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Objection Distribution
          </CardTitle>
          <CardDescription>No objection data recorded yet</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Objections will appear here once extracted from call transcripts
        </CardContent>
      </Card>
    );
  }

  const chartData = data.byType.map((item, index) => ({
    name: getObjectionTypeInfo(item.type).label,
    value: item.count,
    percentage: item.percentage,
    resolutionRate: item.resolutionRate,
    resolved: item.resolved,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Objection Distribution</CardTitle>
              <CardDescription>
                Breakdown of objections by type
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">
            {data.totalObjections} total objections
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pie Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percentage }) => `${name} ${percentage.toFixed(0)}%`}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value} objections`, name]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Details List */}
          <div className="space-y-3">
            {data.byType.slice(0, 6).map((item, index) => {
              const info = getObjectionTypeInfo(item.type);
              return (
                <div key={item.type} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info.icon}</span>
                      <span className="font-medium">{info.label}</span>
                    </div>
                    <Badge variant="secondary">
                      {item.count} ({item.percentage.toFixed(0)}%)
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Resolution Rate</span>
                        <span className="font-medium">{item.resolutionRate.toFixed(0)}%</span>
                      </div>
                      <Progress value={item.resolutionRate} className="h-2" />
                    </div>
                    <div className="flex items-center gap-1">
                      {item.resolutionRate >= 50 ? (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid gap-4 grid-cols-3 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.totalObjections}</div>
            <div className="text-sm text-muted-foreground">Total Objections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{data.totalResolved}</div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{data.overallResolutionRate.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground">Resolution Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
