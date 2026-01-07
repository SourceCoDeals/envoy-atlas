import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BarChart3, Clock, TrendingUp, Users } from 'lucide-react';

export default function CallAnalytics() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Analytics</h1>
          <p className="text-muted-foreground">
            Deep dive into your calling performance metrics
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Disposition Funnel
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
              Connect PhoneBurner to see conversion funnel
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Best Time to Call
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
              Analyze when prospects are most responsive
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
              Compare caller metrics and performance
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Weekly Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
              Track calling trends over time
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}