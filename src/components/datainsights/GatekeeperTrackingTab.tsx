import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Phone, UserCheck, Clock, Ban, MessageSquare, Voicemail } from 'lucide-react';

interface GatekeeperMetrics {
  totalGatekeeperCalls: number;
  outcomes: { outcome: string; count: number; percentage: number }[];
  techniques: { technique: string; successRate: number; count: number }[];
  avgHandlingScore: number;
  transferRate: number;
  blockedRate: number;
}

interface GatekeeperTrackingTabProps {
  metrics: GatekeeperMetrics;
}

const outcomeIcons: Record<string, React.ReactNode> = {
  'Transferred': <UserCheck className="h-4 w-4 text-green-500" />,
  'Callback Scheduled': <Clock className="h-4 w-4 text-blue-500" />,
  'Voicemail Offered': <Voicemail className="h-4 w-4 text-yellow-500" />,
  'Info Gathered': <MessageSquare className="h-4 w-4 text-cyan-500" />,
  'Message Taken': <MessageSquare className="h-4 w-4 text-muted-foreground" />,
  'Blocked': <Ban className="h-4 w-4 text-red-500" />,
};

const outcomeColors: Record<string, string> = {
  'Transferred': 'hsl(142 76% 36%)',
  'Callback Scheduled': 'hsl(217 91% 60%)',
  'Voicemail Offered': 'hsl(45 93% 47%)',
  'Info Gathered': 'hsl(187 85% 53%)',
  'Message Taken': 'hsl(var(--muted-foreground))',
  'Blocked': 'hsl(0 84% 60%)',
};

export function GatekeeperTrackingTab({ metrics }: GatekeeperTrackingTabProps) {
  const successOutcomes = ['Transferred', 'Callback Scheduled'];
  const successRate = metrics.outcomes
    .filter(o => successOutcomes.includes(o.outcome))
    .reduce((sum, o) => sum + o.percentage, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.totalGatekeeperCalls}</div>
                <div className="text-sm text-muted-foreground">Gatekeeper Calls</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.transferRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Transfer Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.avgHandlingScore.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Avg Handling Score</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outcome Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gatekeeper Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.outcomes.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.outcomes}
                      dataKey="count"
                      nameKey="outcome"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ outcome, percentage }) => `${outcome}: ${percentage.toFixed(0)}%`}
                    >
                      {metrics.outcomes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={outcomeColors[entry.outcome] || 'hsl(var(--muted))'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number, name: string) => [`${value} calls`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No gatekeeper data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Technique Effectiveness */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Technique Effectiveness</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.techniques.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.techniques} layout="vertical" margin={{ left: 100 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="technique" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number, _: string, props: any) => [
                        `${value}% success (${props.payload.count} uses)`,
                        'Success Rate'
                      ]}
                    />
                    <Bar dataKey="successRate" radius={[0, 4, 4, 0]}>
                      {metrics.techniques.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.successRate >= 50 ? 'hsl(142 76% 36%)' : entry.successRate >= 30 ? 'hsl(45 93% 47%)' : 'hsl(var(--muted-foreground))'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No technique data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outcome Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Outcome Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {['Transferred', 'Callback Scheduled', 'Voicemail Offered', 'Info Gathered', 'Message Taken', 'Blocked'].map(outcome => {
              const data = metrics.outcomes.find(o => o.outcome === outcome);
              const count = data?.count || 0;
              const percentage = data?.percentage || 0;
              
              return (
                <div key={outcome} className="p-4 bg-muted/30 rounded-lg text-center">
                  <div className="flex justify-center mb-2">
                    {outcomeIcons[outcome]}
                  </div>
                  <div className="text-xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{outcome}</div>
                  <Badge variant="outline" className="mt-1">{percentage.toFixed(1)}%</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gatekeeper Handling Tips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-1 flex items-center gap-2">
                <span className="text-green-500">✓</span> Trigger-Based Opening
              </h4>
              <p className="text-muted-foreground">"Calling about your recent expansion..." - Uses business context to establish relevance.</p>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-1 flex items-center gap-2">
                <span className="text-green-500">✓</span> Name Drop Technique
              </h4>
              <p className="text-muted-foreground">"Following up on correspondence with [Owner]" - Implies prior relationship.</p>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-1 flex items-center gap-2">
                <span className="text-green-500">✓</span> Referral Approach
              </h4>
              <p className="text-muted-foreground">"I was referred by [Name/Company]" - Leverages social proof.</p>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-1 flex items-center gap-2">
                <span className="text-yellow-500">○</span> Callback Request
              </h4>
              <p className="text-muted-foreground">"When would be best to reach [Owner]?" - Falls back to information gathering.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
