import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface ISPData {
  isp_name: string;
  sent_count: number;
  delivery_rate: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

interface ISPDeliverabilityProps {
  data: ISPData[];
}

const ISP_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  yahoo: 'Yahoo',
  apple: 'Apple',
  corporate: 'Corporate',
};

const ISP_COLORS: Record<string, string> = {
  gmail: '#ea4335',
  outlook: '#0078d4',
  yahoo: '#6001d2',
  apple: '#a2aaad',
  corporate: '#64748b',
};

function getRateStatus(rate: number, benchmark: number) {
  const diff = rate - benchmark;
  if (Math.abs(diff) < 2) return { icon: Minus, color: 'text-muted-foreground', label: 'Average' };
  if (diff > 0) return { icon: TrendingUp, color: 'text-green-600', label: 'Above avg' };
  return { icon: TrendingDown, color: 'text-red-600', label: 'Below avg' };
}

export function ISPDeliverability({ data }: ISPDeliverabilityProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deliverability by Provider</CardTitle>
          <CardDescription>Track email performance across different email providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            No ISP data available yet. Data will appear after emails are sent.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate averages for benchmarks
  const totalSent = data.reduce((sum, d) => sum + d.sent_count, 0);
  const avgOpenRate = data.reduce((sum, d) => sum + (d.open_rate * d.sent_count), 0) / totalSent;
  const avgReplyRate = data.reduce((sum, d) => sum + (d.reply_rate * d.sent_count), 0) / totalSent;

  const chartData = data.map(d => ({
    name: ISP_LABELS[d.isp_name] || d.isp_name,
    'Delivery Rate': d.delivery_rate,
    'Open Rate': d.open_rate,
    'Reply Rate': d.reply_rate,
    volume: d.sent_count,
    fill: ISP_COLORS[d.isp_name] || '#64748b',
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deliverability by Email Provider</CardTitle>
        <CardDescription>
          Compare performance across Gmail, Outlook, Yahoo, and corporate domains
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={80} />
              <Tooltip 
                formatter={(value: number) => `${value.toFixed(1)}%`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="Delivery Rate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Open Rate" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Reply Rate" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Volume breakdown table */}
        <div className="border rounded-lg">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Provider</th>
                <th className="text-right p-3 text-sm font-medium">Sent</th>
                <th className="text-right p-3 text-sm font-medium">Delivery</th>
                <th className="text-right p-3 text-sm font-medium">Open Rate</th>
                <th className="text-right p-3 text-sm font-medium">Reply Rate</th>
                <th className="text-right p-3 text-sm font-medium">Bounce</th>
              </tr>
            </thead>
            <tbody>
              {data.map((isp) => {
                const openStatus = getRateStatus(isp.open_rate, avgOpenRate);
                const replyStatus = getRateStatus(isp.reply_rate, avgReplyRate);
                
                return (
                  <tr key={isp.isp_name} className="border-t">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: ISP_COLORS[isp.isp_name] }}
                        />
                        <span className="font-medium">
                          {ISP_LABELS[isp.isp_name] || isp.isp_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {isp.sent_count.toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      {isp.delivery_rate.toFixed(1)}%
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isp.open_rate.toFixed(1)}%
                        <openStatus.icon className={`h-3 w-3 ${openStatus.color}`} />
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isp.reply_rate.toFixed(1)}%
                        <replyStatus.icon className={`h-3 w-3 ${replyStatus.color}`} />
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <Badge 
                        variant={isp.bounce_rate > 3 ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {isp.bounce_rate.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}