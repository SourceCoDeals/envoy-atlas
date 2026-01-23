import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UnassignedCampaignsAlertProps {
  onOpenAutoLink: () => void;
}

export function UnassignedCampaignsAlert({ onOpenAutoLink }: UnassignedCampaignsAlertProps) {
  const [stats, setStats] = useState<{ count: number; totalSent: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('id, total_sent')
          .eq('engagement_id', '00000000-0000-0000-0000-000000000000');

        if (error) throw error;

        const count = data?.length || 0;
        const totalSent = data?.reduce((sum, c) => sum + (c.total_sent || 0), 0) || 0;
        setStats({ count, totalSent });
      } catch (err) {
        console.error('Error fetching unassigned stats:', err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading || !stats || stats.count === 0) {
    return null;
  }

  return (
    <Alert className="border-warning/30 bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 font-bold">
            {stats.count.toLocaleString()}
          </Badge>
          <span>
            campaigns ({stats.totalSent.toLocaleString()} emails sent) are not linked to any engagement.
          </span>
          <span className="text-muted-foreground">
            Review suggested pairings or link them manually.
          </span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="shrink-0 border-warning/50 hover:bg-warning/20"
          onClick={onOpenAutoLink}
        >
          <Link2 className="h-4 w-4 mr-2" />
          Review Matches
        </Button>
      </AlertDescription>
    </Alert>
  );
}
