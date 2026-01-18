import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Ruler, TrendingUp, Info } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Area,
  ComposedChart,
  Legend,
} from 'recharts';

interface LengthBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  avgReplyRate: number;
  avgPositiveRate: number;
  avgMeetingRate?: number;
}

interface AudienceLengthData {
  audience: string;
  optimalWordCount: number;
  optimalReplyRate: number;
  sampleSize: number;
}

interface LengthImpactSectionProps {
  subjectLengthData: LengthBucket[];
  bodyLengthData: LengthBucket[];
  audienceData?: AudienceLengthData[];
}

const formatRate = (value: number) => `${value.toFixed(1)}%`;

export function LengthImpactSection({ 
  subjectLengthData, 
  bodyLengthData,
  audienceData 
}: LengthImpactSectionProps) {
  // Find optimal ranges
  const optimalSubject = [...subjectLengthData].sort((a, b) => b.avgReplyRate - a.avgReplyRate)[0];
  const optimalBody = [...bodyLengthData].sort((a, b) => b.avgReplyRate - a.avgReplyRate)[0];

  // Chart data for subject lines
  const subjectChartData = subjectLengthData.map(d => ({
    range: d.range,
    replyRate: d.avgReplyRate,
    count: d.count,
  }));

  // Chart data for body - multiple metrics
  const bodyChartData = bodyLengthData.map(d => ({
    range: d.range,
    replyRate: d.avgReplyRate,
    positiveRate: d.avgPositiveRate,
    meetingRate: d.avgMeetingRate || 0, // NOTE: meeting rate requires calendar integration - show 0 if not tracked
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Ruler className="h-5 w-5 text-chart-3" />
          <CardTitle className="text-lg">Length Impact Analysis</CardTitle>
        </div>
        <CardDescription>
          How copy length affects outcomes across different metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Subject Line Length */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Subject Line Length</h4>
              {optimalSubject && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                        <TrendingUp className="h-3 w-3" />
                        Optimal: {optimalSubject.range}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatRate(optimalSubject.avgReplyRate)} reply rate</p>
                      <p className="text-xs text-muted-foreground">Based on {optimalSubject.count} variants</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={subjectChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => [formatRate(value), 'Reply Rate']}
                    labelFormatter={(label) => `${label} characters`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="replyRate" 
                    fill="hsl(var(--chart-3))" 
                    fillOpacity={0.2}
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Inbox preview shows ~40-50 characters. Shorter subjects stand out.
            </p>
          </div>

          {/* Body Length - Multiple Metrics */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Body Length (by outcome)</h4>
              {optimalBody && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                        <TrendingUp className="h-3 w-3" />
                        Optimal: {optimalBody.range}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatRate(optimalBody.avgReplyRate)} reply rate</p>
                      <p className="text-xs text-muted-foreground">{optimalBody.count} variants analyzed</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bodyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatRate(value)}
                    labelFormatter={(label) => `${label} words`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="replyRate" 
                    name="Reply Rate"
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-1))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="positiveRate" 
                    name="Positive Rate"
                    stroke="hsl(var(--success))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--success))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="meetingRate" 
                    name="Meeting Rate"
                    stroke="hsl(var(--chart-4))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'hsl(var(--chart-4))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Shorter emails convert better to meetings. Longer emails get more replies but lower quality.
            </p>
          </div>
        </div>

        {/* Audience-specific insights */}
        {audienceData && audienceData.length > 0 && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-chart-1" />
              <h4 className="text-sm font-medium">Length × Audience Interaction</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Optimal body length varies significantly by audience:
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {audienceData.map((item) => (
                <div key={item.audience} className="p-3 bg-background rounded border">
                  <p className="font-medium text-sm">{item.audience}</p>
                  <p className="text-xs text-muted-foreground">
                    Optimal: <span className="text-foreground font-mono">{item.optimalWordCount} words</span>
                  </p>
                  <p className="text-xs text-success">
                    {formatRate(item.optimalReplyRate)} reply rate
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              Enterprise audiences respond better to longer, more detailed emails with proof points.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
