import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Clock, Timer } from 'lucide-react';

interface SummaryCardsProps {
  totalCalls: number;
  avgDuration: number;
  totalDuration: number;
}

export function SummaryCards({ totalCalls, avgDuration, totalDuration }: SummaryCardsProps) {
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
          <Phone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalCalls.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avg Call Duration</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatDuration(avgDuration)}</div>
          <p className="text-xs text-muted-foreground mt-1">{Math.round(avgDuration)} seconds</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Talk Time</CardTitle>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatTotalDuration(totalDuration)}</div>
          <p className="text-xs text-muted-foreground mt-1">{Math.round(totalDuration / 60)} minutes total</p>
        </CardContent>
      </Card>
    </div>
  );
}
