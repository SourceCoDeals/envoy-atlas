import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CategoryBreakdownProps {
  data: { name: string; value: number }[];
  totalCalls: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(220, 70%, 50%)',
  'hsl(280, 65%, 60%)',
  'hsl(340, 75%, 55%)',
  'hsl(30, 80%, 55%)',
  'hsl(160, 60%, 45%)',
  'hsl(200, 70%, 50%)',
  'hsl(260, 65%, 55%)',
  'hsl(320, 70%, 50%)',
  'hsl(40, 75%, 50%)',
];

export function CategoryBreakdown({ data, totalCalls }: CategoryBreakdownProps) {
  const topCategories = data.slice(0, 8);
  const otherCount = data.slice(8).reduce((sum, d) => sum + d.value, 0);
  
  const pieData = otherCount > 0 
    ? [...topCategories, { name: 'Other', value: otherCount }]
    : topCategories;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Categories</CardTitle>
        <CardDescription>Breakdown by disposition category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), 'Calls']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Progress bars list */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {data.slice(0, 12).map((cat, idx) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate max-w-[200px]" title={cat.name}>{cat.name}</span>
                  <span className="text-muted-foreground">{cat.value.toLocaleString()} ({((cat.value / totalCalls) * 100).toFixed(1)}%)</span>
                </div>
                <Progress value={(cat.value / totalCalls) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
