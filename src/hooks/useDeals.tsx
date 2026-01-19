import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface Deal {
  id: string;
  engagement_id: string | null;
  deal_client_id: string | null;
  project_name: string;
  business_description: string | null;
  client_name: string | null;
  geography: string | null;
  industry: string | null;
  sub_industry: string | null;
  revenue: number | null;
  revenue_display: string | null;
  ebitda: number | null;
  ebitda_display: string | null;
  asking_price: number | null;
  asking_price_display: string | null;
  revenue_multiple: number | null;
  ebitda_multiple: number | null;
  stage: string;
  teaser_url: string | null;
  cim_url: string | null;
  notes: string | null;
  pass_reason: string | null;
  source_type: string | null;
  assigned_to: string | null;
  received_at: string | null;
  nda_signed_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealClient {
  id: string;
  engagement_id: string | null;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  client_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealStats {
  totalDeals: number;
  totalRevenue: number;
  avgEbitda: number;
  totalClients: number;
}

export function useDeals() {
  const { currentWorkspace } = useWorkspace();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<DealClient[]>([]);
  const [stats, setStats] = useState<DealStats>({
    totalDeals: 0,
    totalRevenue: 0,
    avgEbitda: 0,
    totalClients: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Get engagements for this client/workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setDeals([]);
        setClients([]);
        setStats({ totalDeals: 0, totalRevenue: 0, avgEbitda: 0, totalClients: 0 });
        setLoading(false);
        return;
      }

      const [dealsResult, clientsResult] = await Promise.all([
        supabase
          .from('deals')
          .select('*')
          .in('engagement_id', engagementIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('deal_clients')
          .select('*')
          .in('engagement_id', engagementIds)
          .order('name', { ascending: true }),
      ]);

      if (dealsResult.error) throw dealsResult.error;
      if (clientsResult.error) throw clientsResult.error;

      const dealsData = (dealsResult.data || []) as Deal[];
      const clientsData = (clientsResult.data || []) as DealClient[];

      setDeals(dealsData);
      setClients(clientsData);

      // Calculate stats
      const totalRevenue = dealsData.reduce((sum, d) => sum + (d.revenue || 0), 0);
      const totalEbitda = dealsData.reduce((sum, d) => sum + (d.ebitda || 0), 0);
      const dealsWithEbitda = dealsData.filter(d => d.ebitda !== null).length;

      setStats({
        totalDeals: dealsData.length,
        totalRevenue,
        avgEbitda: dealsWithEbitda > 0 ? totalEbitda / dealsWithEbitda : 0,
        totalClients: clientsData.length,
      });
    } catch (err) {
      console.error('Error fetching deals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch deals');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const createDeal = async (deal: Omit<Deal, 'id' | 'created_at' | 'updated_at'> & { project_name: string }) => {
    if (!currentWorkspace?.id) throw new Error('No workspace selected');

    // Get first engagement for this workspace
    const { data: engagements } = await supabase
      .from('engagements')
      .select('id')
      .eq('client_id', currentWorkspace.id)
      .limit(1);

    const engagementId = engagements?.[0]?.id;

    const { data, error } = await supabase
      .from('deals')
      .insert([{ 
        project_name: deal.project_name,
        engagement_id: engagementId,
        business_description: deal.business_description,
        client_name: deal.client_name,
        geography: deal.geography,
        industry: deal.industry,
        sub_industry: deal.sub_industry,
        revenue: deal.revenue,
        ebitda: deal.ebitda,
        stage: deal.stage || 'new',
      }])
      .select()
      .single();

    if (error) throw error;
    await fetchDeals();
    return data;
  };

  const updateDeal = async (id: string, updates: Partial<Deal>) => {
    const { data, error } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await fetchDeals();
    return data;
  };

  const deleteDeal = async (id: string) => {
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchDeals();
  };

  const createClient = async (client: Omit<DealClient, 'id' | 'created_at' | 'updated_at'> & { name: string }) => {
    if (!currentWorkspace?.id) throw new Error('No workspace selected');

    // Get first engagement for this workspace
    const { data: engagements } = await supabase
      .from('engagements')
      .select('id')
      .eq('client_id', currentWorkspace.id)
      .limit(1);

    const engagementId = engagements?.[0]?.id;

    const { data, error } = await supabase
      .from('deal_clients')
      .insert([{ 
        name: client.name,
        engagement_id: engagementId,
        contact_name: client.contact_name,
        contact_email: client.contact_email,
        contact_phone: client.contact_phone,
        client_type: client.client_type,
      }])
      .select()
      .single();

    if (error) throw error;
    await fetchDeals();
    return data;
  };

  return {
    deals,
    clients,
    stats,
    loading,
    error,
    refetch: fetchDeals,
    createDeal,
    updateDeal,
    deleteDeal,
    createClient,
  };
}
