import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

interface CallsByAnalystChartProps {
  data: Record<string, any>[];
  analysts: string[];
}

const ANALYST_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(220, 70%, 50%)',
];

export function CallsByAnalystChart({ data, analysts }: CallsByAnalystChartProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calls by Analyst Over Time</CardTitle>
          <CardDescription>Daily call count per analyst</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center text-muted-foreground">
          No data available for the selected filters
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calls by Analyst Over Time</CardTitle>
        <CardDescription>Daily call count per analyst</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                labelFormatter={(label) => format(parseISO(label as string), 'MMMM d, yyyy')}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {analysts.map((analyst, idx) => (
                <Line
                  key={analyst}
                  type="monotone"
                  dataKey={analyst}
                  stroke={ANALYST_COLORS[idx % ANALYST_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
