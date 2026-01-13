import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OpportunityChartProps {
  data: { name: string; value: number }[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function OpportunityChart({ data }: OpportunityChartProps) {
  // Truncate long names for display
  const chartData = data.map(d => ({
    ...d,
    displayName: d.name.length > 25 ? d.name.substring(0, 22) + '...' : d.name,
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calls by Primary Opportunity</CardTitle>
          <CardDescription>Top opportunities by call volume</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center text-muted-foreground">
          No data available for the selected filters
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calls by Primary Opportunity</CardTitle>
        <CardDescription>Top {data.length} opportunities by call volume</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis 
                dataKey="displayName" 
                type="category" 
                width={110}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), 'Calls']}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.displayName === label);
                  return item ? item.name : label;
                }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
