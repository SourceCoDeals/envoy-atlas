import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Calendar, TrendingUp, AlertCircle } from 'lucide-react';

interface ProspectMetrics {
  industryBreakdown: { industry: string; calls: number; connects: number; meetings: number }[];
  openingTypeEffectiveness: { type: string; successRate: number; count: number }[];
  topPainPoints: { painPoint: string; count: number }[];
  pendingFollowUps: number;
}

interface ProspectStrategyTabProps {
  metrics: ProspectMetrics;
}

export function ProspectStrategyTab({ metrics }: ProspectStrategyTabProps) {
  const getSuccessColor = (rate: number) => {
    if (rate >= 50) return 'hsl(142 76% 36%)';
    if (rate >= 30) return 'hsl(45 93% 47%)';
    return 'hsl(var(--muted-foreground))';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.industryBreakdown.length}</div>
                <div className="text-sm text-muted-foreground">Industries Contacted</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.openingTypeEffectiveness.length}</div>
                <div className="text-sm text-muted-foreground">Opening Types Used</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.topPainPoints.length}</div>
                <div className="text-sm text-muted-foreground">Pain Points Identified</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.pendingFollowUps}</div>
                <div className="text-sm text-muted-foreground">Pending Follow-Ups</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opening Type Effectiveness */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Opening Type Effectiveness</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.openingTypeEffectiveness.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={metrics.openingTypeEffectiveness} 
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <XAxis 
                      type="number"
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis 
                      type="category"
                      dataKey="type"
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number, _name: string, props: any) => [
                        `${value}% success (${props.payload.count} calls)`,
                        'Effectiveness'
                      ]}
                    />
                    <Bar 
                      dataKey="successRate" 
                      radius={[0, 4, 4, 0]}
                    >
                      {metrics.openingTypeEffectiveness.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getSuccessColor(entry.successRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No opening type data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Industry Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Industry Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.industryBreakdown.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {metrics.industryBreakdown.map((industry, idx) => {
                  const meetingRate = industry.calls > 0 
                    ? ((industry.meetings / industry.calls) * 100).toFixed(1) 
                    : '0';
                  return (
                    <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{industry.industry}</span>
                        <Badge variant="outline">{industry.calls} calls</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{industry.connects} connects</span>
                        <span>{industry.meetings} meetings</span>
                        <span className="text-primary font-medium">{meetingRate}% meeting rate</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No industry data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pain Points */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top Pain Points Identified</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.topPainPoints.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {metrics.topPainPoints.map((point, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary"
                  className="text-sm py-1.5 px-3"
                >
                  {point.painPoint}
                  <span className="ml-2 text-muted-foreground">({point.count})</span>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Pain points will appear here as they're extracted from call AI analysis
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy Recommendations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Strategy Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Best Performing Approach</h4>
              {metrics.openingTypeEffectiveness.length > 0 ? (
                <>
                  <div className="text-xl font-bold text-primary">
                    {metrics.openingTypeEffectiveness.sort((a, b) => b.successRate - a.successRate)[0]?.type || 'N/A'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {metrics.openingTypeEffectiveness[0]?.successRate || 0}% success rate
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">No data yet</div>
              )}
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Top Industry</h4>
              {metrics.industryBreakdown.length > 0 ? (
                <>
                  <div className="text-xl font-bold text-emerald-500">
                    {metrics.industryBreakdown.sort((a, b) => b.meetings - a.meetings)[0]?.industry || 'N/A'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {metrics.industryBreakdown[0]?.meetings || 0} meetings booked
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">No data yet</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
