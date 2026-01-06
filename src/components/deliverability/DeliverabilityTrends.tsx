import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown,
  Minus,
  Activity,
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface TrendDataPoint {
  date: string;
  riskScore: number;
  bounceRate: number;
  complaintRate: number;
  inboxRate: number;
}

interface KeyEvent {
  date: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface DeliverabilityTrendsProps {
  data: TrendDataPoint[];
  keyEvents?: KeyEvent[];
  period?: '7d' | '30d' | '90d';
}

export function DeliverabilityTrends({ 
  data, 
  keyEvents = [],
  period = '30d' 
}: DeliverabilityTrendsProps) {
  const latestData = data[data.length - 1];
  const firstData = data[0];

  const calculateTrend = (current: number, previous: number, inverse = false) => {
    const diff = current - previous;
    const percentChange = previous > 0 ? (diff / previous) * 100 : 0;
    const isImproving = inverse ? diff < 0 : diff > 0;
    return { diff, percentChange, isImproving };
  };

  const riskTrend = calculateTrend(latestData?.riskScore || 0, firstData?.riskScore || 0, true);
  const bounceTrend = calculateTrend(latestData?.bounceRate || 0, firstData?.bounceRate || 0, true);
  const inboxTrend = calculateTrend(latestData?.inboxRate || 0, firstData?.inboxRate || 0);

  const getTrendIcon = (isImproving: boolean, diff: number) => {
    if (Math.abs(diff) < 0.1) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (isImproving) return <TrendingDown className="h-3 w-3 text-success" />;
    return <TrendingUp className="h-3 w-3 text-destructive" />;
  };

  const periodLabel = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
  }[period];

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Deliverability Trends
          </CardTitle>
          <Badge variant="outline">{periodLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{latestData?.riskScore || 0}</span>
              <div className={`flex items-center gap-1 text-xs ${riskTrend.isImproving ? 'text-success' : 'text-destructive'}`}>
                {getTrendIcon(riskTrend.isImproving, riskTrend.diff)}
                <span>{Math.abs(riskTrend.diff).toFixed(0)} pts</span>
              </div>
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Bounce Rate</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{(latestData?.bounceRate || 0).toFixed(2)}%</span>
              <div className={`flex items-center gap-1 text-xs ${bounceTrend.isImproving ? 'text-success' : 'text-destructive'}`}>
                {getTrendIcon(bounceTrend.isImproving, bounceTrend.diff)}
                <span>{Math.abs(bounceTrend.diff).toFixed(2)}%</span>
              </div>
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Inbox Rate</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{(latestData?.inboxRate || 0).toFixed(0)}%</span>
              <div className={`flex items-center gap-1 text-xs ${inboxTrend.isImproving ? 'text-success' : 'text-destructive'}`}>
                {getTrendIcon(inboxTrend.isImproving, -inboxTrend.diff)}
                <span>{Math.abs(inboxTrend.diff).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
                domain={[0, 100]}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }} 
                className="text-muted-foreground"
                domain={[0, 10]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="riskScore" 
                name="Risk Score"
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="bounceRate" 
                name="Bounce Rate %"
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="inboxRate" 
                name="Inbox Rate %"
                stroke="hsl(var(--success))" 
                strokeWidth={2}
                dot={false}
              />
              <ReferenceLine yAxisId="right" y={3} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Key Events */}
        {keyEvents.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Key Events</h4>
            <div className="space-y-2">
              {keyEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-muted-foreground w-16">
                    {format(new Date(event.date), 'MMM d')}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${
                    event.impact === 'positive' ? 'bg-success' :
                    event.impact === 'negative' ? 'bg-destructive' : 'bg-muted-foreground'
                  }`} />
                  <span>{event.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
