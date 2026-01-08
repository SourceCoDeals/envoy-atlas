import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { AlertTriangle, PhoneOff, Home, Building2, Printer, WifiOff, CheckCircle2 } from 'lucide-react';

interface WrongNumberMetrics {
  totalWrongNumbers: number;
  wrongNumberRate: number;
  typeBreakdown: { type: string; count: number; percentage: number }[];
  sourceQuality: { source: string; wrongCount: number; totalCount: number; rate: number }[];
  correctedCount: number;
  timeWasted: number; // in minutes
}

interface WrongNumberTrackingTabProps {
  metrics: WrongNumberMetrics;
}

const typeIcons: Record<string, React.ReactNode> = {
  'Wrong Person': <Building2 className="h-4 w-4 text-yellow-500" />,
  'Wrong Company': <Building2 className="h-4 w-4 text-orange-500" />,
  'Residential': <Home className="h-4 w-4 text-blue-500" />,
  'Fax Line': <Printer className="h-4 w-4 text-purple-500" />,
  'Disconnected': <PhoneOff className="h-4 w-4 text-red-500" />,
  'Out of Service': <WifiOff className="h-4 w-4 text-muted-foreground" />,
};

const typeColors: Record<string, string> = {
  'Wrong Person': 'hsl(45 93% 47%)',
  'Wrong Company': 'hsl(25 95% 53%)',
  'Residential': 'hsl(217 91% 60%)',
  'Fax Line': 'hsl(271 91% 65%)',
  'Disconnected': 'hsl(0 84% 60%)',
  'Out of Service': 'hsl(var(--muted-foreground))',
};

const getSourceGrade = (rate: number): { grade: string; color: string } => {
  if (rate < 2) return { grade: 'A', color: 'text-green-500' };
  if (rate < 5) return { grade: 'B', color: 'text-blue-500' };
  if (rate < 10) return { grade: 'C', color: 'text-yellow-500' };
  if (rate < 20) return { grade: 'D', color: 'text-orange-500' };
  return { grade: 'F', color: 'text-red-500' };
};

export function WrongNumberTrackingTab({ metrics }: WrongNumberTrackingTabProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <PhoneOff className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.totalWrongNumbers}</div>
                <div className="text-sm text-muted-foreground">Wrong Numbers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.wrongNumberRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Wrong Number Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.correctedCount}</div>
                <div className="text-sm text-muted-foreground">Corrected</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.timeWasted} min</div>
                <div className="text-sm text-muted-foreground">Time Wasted</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Wrong Number Types</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.typeBreakdown.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.typeBreakdown}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ type, percentage }) => `${type}: ${percentage.toFixed(0)}%`}
                    >
                      {metrics.typeBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={typeColors[entry.type] || 'hsl(var(--muted))'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No wrong number data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Source Quality */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Data Source Quality</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.sourceQuality.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.sourceQuality} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="source" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number, _: string, props: any) => [
                        `${value.toFixed(1)}% wrong (${props.payload.wrongCount}/${props.payload.totalCount})`,
                        'Wrong Rate'
                      ]}
                    />
                    <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                      {metrics.sourceQuality.map((entry, index) => {
                        const { color } = getSourceGrade(entry.rate);
                        const fill = color.includes('green') ? 'hsl(142 76% 36%)' :
                                     color.includes('blue') ? 'hsl(217 91% 60%)' :
                                     color.includes('yellow') ? 'hsl(45 93% 47%)' :
                                     color.includes('orange') ? 'hsl(25 95% 53%)' :
                                     'hsl(0 84% 60%)';
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No data source information yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Type Breakdown Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {['Wrong Person', 'Wrong Company', 'Residential', 'Fax Line', 'Disconnected', 'Out of Service'].map(type => {
              const data = metrics.typeBreakdown.find(t => t.type === type);
              const count = data?.count || 0;
              
              return (
                <div key={type} className="p-4 bg-muted/30 rounded-lg text-center">
                  <div className="flex justify-center mb-2">
                    {typeIcons[type]}
                  </div>
                  <div className="text-xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{type}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Source Quality Grades */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Data Source Grades</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.sourceQuality.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.sourceQuality.map((source, idx) => {
                const { grade, color } = getSourceGrade(source.rate);
                return (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium truncate">{source.source}</span>
                      <span className={`text-2xl font-bold ${color}`}>{grade}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {source.wrongCount} wrong / {source.totalCount} total
                    </div>
                    <Badge variant={grade === 'A' || grade === 'B' ? 'default' : 'destructive'} className="mt-2">
                      {source.rate.toFixed(1)}% wrong rate
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Source quality will appear as wrong numbers are tracked
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <h4 className="font-medium mb-1 text-red-500">Disconnected Numbers</h4>
              <p className="text-muted-foreground">Remove from database immediately. These contacts cannot be reached at this number.</p>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <h4 className="font-medium mb-1 text-yellow-500">Wrong Person/Company</h4>
              <p className="text-muted-foreground">Research correct number. Contact may still be valid at a different line.</p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-medium mb-1 text-blue-500">Residential Lines</h4>
              <p className="text-muted-foreground">Remove personal numbers. Find business line instead.</p>
            </div>
            <div className="p-3 bg-muted border rounded-lg">
              <h4 className="font-medium mb-1">Out of Service</h4>
              <p className="text-muted-foreground">May be temporary. Flag for retry in 2-4 weeks.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
