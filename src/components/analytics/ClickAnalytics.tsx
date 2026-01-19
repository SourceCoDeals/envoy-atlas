import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MousePointer, Link2, TrendingUp, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface LinkClickData {
  url: string;
  clicks: number;
  unique_clicks: number;
  replies_after_click: number;
}

interface ClickAnalyticsProps {
  totalClicks: number;
  uniqueClicks: number;
  clickToReplyRate: number;
  topLinks: LinkClickData[];
  clicksByHour: { hour: number; clicks: number }[];
  className?: string;
}

export function ClickAnalytics({ 
  totalClicks, 
  uniqueClicks, 
  clickToReplyRate,
  topLinks, 
  clicksByHour,
  className 
}: ClickAnalyticsProps) {
  // Format URL for display
  const formatUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname.substring(0, 30) : '');
    } catch {
      return url.substring(0, 40);
    }
  };

  // Format hour for display
  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${ampm}`;
  };

  const maxClicks = Math.max(...topLinks.map(l => l.clicks), 1);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MousePointer className="h-5 w-5" />
              Click Analytics
            </CardTitle>
            <CardDescription>
              Link engagement and conversion tracking
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {clickToReplyRate.toFixed(1)}% click-to-reply
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointer className="h-4 w-4" />
              <span className="text-sm">Total Clicks</span>
            </div>
            <span className="text-2xl font-bold">{totalClicks.toLocaleString()}</span>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Link2 className="h-4 w-4" />
              <span className="text-sm">Unique Clickers</span>
            </div>
            <span className="text-2xl font-bold">{uniqueClicks.toLocaleString()}</span>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Avg Clicks/User</span>
            </div>
            <span className="text-2xl font-bold">
              {uniqueClicks > 0 ? (totalClicks / uniqueClicks).toFixed(1) : '0'}
            </span>
          </div>
        </div>

        {/* Clicks by Hour Chart */}
        {clicksByHour.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Clicks by Hour (UTC)</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clicksByHour}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={formatHour}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip
                    formatter={(value: number) => [value, 'Clicks']}
                    labelFormatter={(label) => `${formatHour(label as number)}`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Links */}
        <div>
          <h4 className="text-sm font-medium mb-3">Top Clicked Links</h4>
          <div className="space-y-3">
            {topLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No link click data available</p>
            ) : (
              topLinks.slice(0, 5).map((link, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline truncate max-w-[70%]"
                    >
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      {formatUrl(link.url)}
                    </a>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{link.clicks}</span>
                      {link.replies_after_click > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {link.replies_after_click} replies
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={(link.clicks / maxClicks) * 100} className="h-2" />
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}