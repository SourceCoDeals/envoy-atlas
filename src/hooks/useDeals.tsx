import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface Deal {
  id: string;
  workspace_id: string;
  project_name: string;
  business_description: string | null;
  client_id: string | null;
  client_name: string | null;
  geography: string | null;
  industry: string | null;
  revenue: number | null;
  ebitda: number | null;
  stage: string;
  teaser_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DealClient {
  id: string;
  workspace_id: string;
  name: string;
  contact_email: string | null;
  created_at: string;
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
      const [dealsResult, clientsResult] = await Promise.all([
        supabase
          .from('deals')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('deal_clients')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('name', { ascending: true }),
      ]);

      if (dealsResult.error) throw dealsResult.error;
      if (clientsResult.error) throw clientsResult.error;

      const dealsData = dealsResult.data || [];
      const clientsData = clientsResult.data || [];

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

  const createDeal = async (deal: Omit<Deal, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('deals')
      .insert([deal])
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

  const createClient = async (client: Omit<DealClient, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('deal_clients')
      .insert([client])
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
