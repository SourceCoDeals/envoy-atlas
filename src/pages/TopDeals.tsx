import { useEffect, useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  Building2,
  DollarSign,
  Users,
  MapPin,
  Calendar,
  Star,
  Phone,
  Mail,
  ChevronRight,
  Loader2,
  TrendingUp,
  Clock,
  Heart,
} from 'lucide-react';

interface Deal {
  id: string;
  project_name: string;
  industry: string | null;
  geography: string | null;
  revenue: number | null;
  ebitda: number | null;
  asking_price: number | null;
  stage: string;
  business_description: string | null;
  created_at: string;
}

export default function TopDeals() {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchDeals();
    }
  }, [currentWorkspace?.id]);

  const fetchDeals = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = engagements?.map(e => e.id) || [];
      if (engagementIds.length === 0) {
        setDeals([]);
        setLoading(false);
        return;
      }

      // Fetch deals from the deals table
      const { data, error } = await supabase
        .from('deals')
        .select('id, project_name, industry, geography, revenue, ebitda, asking_price, stage, business_description, created_at')
        .in('engagement_id', engagementIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDeals(data || []);
    } catch (err) {
      console.error('Error fetching deals:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (stage: string) => {
    if (stage === 'closed' || stage === 'won') return 'text-green-600';
    if (stage === 'active' || stage === 'negotiation') return 'text-yellow-600';
    return 'text-muted-foreground';
  };

  const getScoreBg = (stage: string) => {
    if (stage === 'closed' || stage === 'won') return 'bg-green-500/10 border-green-500/30';
    if (stage === 'active' || stage === 'negotiation') return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-muted/10 border-muted/30';
  };

  const formatRevenue = (revenue: number | null) => {
    if (!revenue) return 'N/A';
    if (revenue >= 1000000) return `$${(revenue / 1000000).toFixed(1)}M`;
    if (revenue >= 1000) return `$${(revenue / 1000).toFixed(0)}K`;
    return `$${revenue}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Top Deals</h1>
          <p className="text-muted-foreground">Best opportunities ranked by size + stage</p>
        </div>

        {/* Score Legend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deal Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-chart-1" />
                <span>Revenue/EBITDA</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-chart-2" />
                <span>Deal Stage</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-chart-3" />
                <span>Timeline</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Deals Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Deals are created from calls where opportunities are detected. Keep dialing!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {deals.map((deal, index) => (
              <Card
                key={deal.id}
                className={`hover:border-primary/50 transition-colors cursor-pointer ${getScoreBg(deal.stage)}`}
                onClick={() => setSelectedDeal(deal)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-background flex items-center justify-center font-bold">
                      {index < 3 ? (
                        <Star className={`h-5 w-5 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-amber-600'}`} />
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </div>

                    {/* Company Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{deal.project_name}</h3>
                        <Badge variant="outline" className="text-xs capitalize">
                          {deal.stage}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {deal.industry && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {deal.industry}
                          </span>
                        )}
                        {deal.geography && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {deal.geography}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="hidden md:flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{formatRevenue(deal.revenue)}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{formatRevenue(deal.ebitda)}</p>
                        <p className="text-xs text-muted-foreground">EBITDA</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{formatRevenue(deal.asking_price)}</p>
                        <p className="text-xs text-muted-foreground">Asking</p>
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Deal Detail Dialog */}
      <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
        <DialogContent className="max-w-2xl">
          {selectedDeal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedDeal.project_name}
                  <Badge className={getScoreBg(selectedDeal.stage)} variant="outline">
                    {selectedDeal.stage}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Company Info */}
                <div>
                  <h4 className="font-medium mb-2">Deal Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>Revenue: {formatRevenue(selectedDeal.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>EBITDA: {formatRevenue(selectedDeal.ebitda)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Industry: {selectedDeal.industry || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>Location: {selectedDeal.geography || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedDeal.business_description && (
                  <div>
                    <h4 className="font-medium mb-2">Business Description</h4>
                    <p className="text-sm text-muted-foreground">{selectedDeal.business_description}</p>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                  <Button className="flex-1">
                    View Full Record
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
