import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Shield } from 'lucide-react';

export default function Deliverability() {
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
          <h1 className="text-2xl font-bold tracking-tight">Deliverability</h1>
          <p className="text-muted-foreground">
            Monitor domain health, authentication, and inbox placement
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Deliverability Dashboard Coming</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Track SPF, DKIM, DMARC status, bounce rates, and mailbox health scores 
              to ensure your emails reach the inbox.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}