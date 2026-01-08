import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';

interface ObjectionStats {
  objection: string;
  count: number;
}

interface ObjectionAnalysisProps {
  objections: ObjectionStats[];
}

export function ObjectionAnalysis({ objections }: ObjectionAnalysisProps) {
  // Format objections for chart
  const chartData = objections.slice(0, 8).map((o) => ({
    name: o.objection.length > 20 ? o.objection.substring(0, 20) + '...' : o.objection,
    fullName: o.objection,
    count: o.count,
  }));

  const totalObjections = objections.reduce((sum, o) => sum + o.count, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Common Objections</CardTitle>
          <Badge variant="outline">{totalObjections} Total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {objections.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No objections recorded yet
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={75}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{payload[0].payload.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            Count: {payload[0].value}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {objections.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">All Objections</p>
            <div className="flex flex-wrap gap-2">
              {objections.map((o, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {o.objection} ({o.count})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
