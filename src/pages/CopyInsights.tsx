import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText } from 'lucide-react';

export default function CopyInsights() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Copy Insights</h1>
          <p className="text-muted-foreground">
            Analyze subject lines, body copy, and CTAs that drive replies
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-2xl bg-chart-4/10 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-chart-4" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Copy Analysis Coming</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Rank subject lines and bodies by reply rate, identify winning patterns, 
              and see what copy drives the most positive responses.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}