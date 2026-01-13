import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';

interface DurationChartsProps {
  durationDistribution: { name: string; value: number }[];
  durationTrends: { date: string; totalDuration: number; avgDuration: number; callCount: number }[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function DurationCharts({ durationDistribution, durationTrends }: DurationChartsProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Duration Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Call Duration Distribution</CardTitle>
          <CardDescription>Breakdown of calls by duration range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {durationDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={durationDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={true}
                  >
                    {durationDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const total = durationDistribution.reduce((sum, d) => sum + d.value, 0);
                        const percentage = ((data.value / total) * 100).toFixed(1);
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-foreground">{data.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {data.value.toLocaleString()} calls ({percentage}%)
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Total calls: {total.toLocaleString()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No duration data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Duration Trends Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Duration Trends</CardTitle>
          <CardDescription>Total and average call duration over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {durationTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={durationTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    yAxisId="left"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Total (min)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Avg (sec)', angle: 90, position: 'insideRight', style: { fill: 'hsl(var(--muted-foreground))' } }}
                  />
                  <Tooltip 
                    labelFormatter={(label) => {
                      try {
                        return format(parseISO(label as string), 'MMMM d, yyyy');
                      } catch {
                        return label;
                      }
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'totalDuration') return [`${value} min`, 'Total Duration'];
                      if (name === 'avgDuration') return [`${value} sec`, 'Avg Duration'];
                      return [value, name];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalDuration"
                    name="Total Duration (min)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgDuration"
                    name="Avg Duration (sec)"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
