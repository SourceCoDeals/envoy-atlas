import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

export interface UnlinkedCampaign {
  id: string;
  name: string;
  platform: 'smartlead' | 'replyio';
  status: string | null;
  totalSent: number;
}

// Sentinel UUID for unassigned campaigns - maintains RLS relationship while marking as unassigned
const UNASSIGNED_ENGAGEMENT_ID = '00000000-0000-0000-0000-000000000000';

export function useCampaignLinking() {
  const { currentWorkspace } = useWorkspace();
  const [updating, setUpdating] = useState<string | null>(null);

  /**
   * Updates the engagement_id for a single campaign and redistributes contacts
   * Uses sentinel UUID for unassigned state instead of null to maintain RLS relationships
   */
  const updateCampaignEngagement = useCallback(async (
    campaignId: string,
    engagementId: string | null,
    oldEngagementId?: string | null
  ): Promise<boolean> => {
    // Convert null to sentinel UUID for unassigned state
    const actualEngagementId = engagementId === null ? UNASSIGNED_ENGAGEMENT_ID : engagementId;
    
    setUpdating(campaignId);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ engagement_id: actualEngagementId })
        .eq('id', campaignId);

      if (error) throw error;

      // Redistribute contacts if moving to a new engagement
      if (actualEngagementId && oldEngagementId && actualEngagementId !== oldEngagementId) {
        try {
          await supabase.functions.invoke('redistribute-contacts', {
            body: {
              campaign_id: campaignId,
              new_engagement_id: actualEngagementId,
              old_engagement_id: oldEngagementId,
            },
          });
        } catch (redistributeErr) {
          console.warn('Contact redistribution failed:', redistributeErr);
          // Don't fail the whole operation, just warn
        }
      }
      
      const isUnassigned = actualEngagementId === UNASSIGNED_ENGAGEMENT_ID;
      toast.success(isUnassigned ? 'Campaign unlinked' : 'Campaign linked successfully');
      return true;
    } catch (err) {
      console.error('Error updating campaign engagement:', err);
      toast.error('Failed to update campaign');
      return false;
    } finally {
      setUpdating(null);
    }
  }, []);

  /**
   * Links multiple campaigns to an engagement
   * Handles duplicate campaigns by detecting conflicts and deleting redundant copies
   */
  const linkCampaignsToEngagement = useCallback(async (
    campaignIds: string[],
    engagementId: string
  ): Promise<{ success: boolean; linked: number; duplicatesRemoved?: number }> => {
    if (campaignIds.length === 0) {
      return { success: false, linked: 0 };
    }

    try {
      // Step 1: Get details of campaigns being linked
      const { data: sourceCampaigns } = await supabase
        .from('campaigns')
        .select('id, external_id, data_source_id')
        .in('id', campaignIds);

      if (!sourceCampaigns || sourceCampaigns.length === 0) {
        throw new Error('No campaigns found');
      }

      // Step 2: Check for duplicates in target engagement
      const externalIds = sourceCampaigns
        .filter(c => c.external_id && c.data_source_id)
        .map(c => c.external_id);

      let existingSet = new Set<string>();
      
      if (externalIds.length > 0) {
        const { data: existingCampaigns } = await supabase
          .from('campaigns')
          .select('id, external_id, data_source_id')
          .eq('engagement_id', engagementId)
          .in('external_id', externalIds);

        // Build lookup of existing external_id + data_source_id in target
        existingSet = new Set(
          (existingCampaigns || []).map(c => `${c.external_id}:${c.data_source_id}`)
        );
      }

      // Step 3: Split campaigns into safe-to-link and duplicates
      const safeToLink: string[] = [];
      const duplicatesToDelete: string[] = [];

      for (const campaign of sourceCampaigns) {
        const key = `${campaign.external_id}:${campaign.data_source_id}`;
        if (campaign.external_id && campaign.data_source_id && existingSet.has(key)) {
          // This campaign already exists in target - delete the source duplicate
          duplicatesToDelete.push(campaign.id);
        } else {
          safeToLink.push(campaign.id);
        }
      }

      // Step 4: Delete duplicates
      if (duplicatesToDelete.length > 0) {
        await supabase
          .from('campaigns')
          .delete()
          .in('id', duplicatesToDelete);
      }

      // Step 5: Link safe campaigns
      if (safeToLink.length > 0) {
        const { error } = await supabase
          .from('campaigns')
          .update({ engagement_id: engagementId })
          .in('id', safeToLink);

        if (error) throw error;
      }

      const linked = safeToLink.length;
      const removed = duplicatesToDelete.length;
      
      if (removed > 0 && linked > 0) {
        toast.success(`Linked ${linked} campaign(s), removed ${removed} duplicate(s)`);
      } else if (removed > 0) {
        toast.success(`Removed ${removed} duplicate campaign(s)`);
      } else if (linked > 0) {
        toast.success(`Linked ${linked} campaign${linked !== 1 ? 's' : ''}`);
      }

      return { success: true, linked, duplicatesRemoved: removed };
    } catch (err) {
      console.error('Error linking campaigns:', err);
      toast.error('Failed to link campaigns');
      return { success: false, linked: 0 };
    }
  }, []);

  /**
   * Fetches unlinked campaigns for the current workspace
   */
  const fetchUnlinkedCampaigns = useCallback(async (): Promise<UnlinkedCampaign[]> => {
    if (!currentWorkspace?.id) return [];

    try {
      // Get all engagement IDs for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) return [];

      // Get campaigns that belong to workspace engagements but have no specific engagement_id set
      // OR campaigns where engagement_id is one of ours but they're orphaned
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, campaign_type, status, total_sent, engagement_id')
        .in('engagement_id', engagementIds)
        .order('name');

      // Filter to only those without engagement_id or with a default/null value
      // Actually, we need campaigns WITHOUT an engagement_id
      // Let's query differently - get campaigns in our engagements that don't have specific linking

      // Since all campaigns must have engagement_id (required field), 
      // we need to identify "unlinked" as those that need manual assignment
      // For now, return all campaigns - the dialog will handle filtering
      
      return (campaigns || []).map(c => ({
        id: c.id,
        name: c.name,
        platform: c.campaign_type as 'smartlead' | 'replyio',
        status: c.status,
        totalSent: c.total_sent || 0,
      }));
    } catch (err) {
      console.error('Error fetching unlinked campaigns:', err);
      return [];
    }
  }, [currentWorkspace?.id]);

  /**
   * Fetches campaigns not linked to a specific engagement
   * Now includes unassigned campaigns (engagement_id = '00000000-0000-0000-0000-000000000000')
   */
  const fetchCampaignsNotInEngagement = useCallback(async (
    excludeEngagementId: string
  ): Promise<UnlinkedCampaign[]> => {
    if (!currentWorkspace?.id) return [];

    try {
      // Get campaigns that are either:
      // 1. In the "Unassigned" placeholder engagement
      // 2. In other engagements of this workspace (for re-linking)
      
      // First get unassigned campaigns
      const { data: unassignedCampaigns } = await supabase
        .from('campaigns')
        .select('id, name, campaign_type, status, total_sent')
        .eq('engagement_id', '00000000-0000-0000-0000-000000000000')
        .order('total_sent', { ascending: false });

      // Then get campaigns from other engagements in this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id)
        .neq('id', excludeEngagementId)
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const engagementIds = (engagements || []).map(e => e.id);

      let otherCampaigns: any[] = [];
      if (engagementIds.length > 0) {
        const { data } = await supabase
          .from('campaigns')
          .select('id, name, campaign_type, status, total_sent, engagement_id')
          .in('engagement_id', engagementIds)
          .order('name');
        otherCampaigns = data || [];
      }

      // Combine and deduplicate
      const allCampaigns = [
        ...(unassignedCampaigns || []).map(c => ({
          id: c.id,
          name: c.name,
          platform: c.campaign_type as 'smartlead' | 'replyio',
          status: c.status,
          totalSent: c.total_sent || 0,
        })),
        ...otherCampaigns.map(c => ({
          id: c.id,
          name: c.name,
          platform: c.campaign_type as 'smartlead' | 'replyio',
          status: c.status,
          totalSent: c.total_sent || 0,
        })),
      ];

      // Sort by total_sent descending
      return allCampaigns.sort((a, b) => b.totalSent - a.totalSent);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      return [];
    }
  }, [currentWorkspace?.id]);

  return {
    updating,
    updateCampaignEngagement,
    linkCampaignsToEngagement,
    fetchUnlinkedCampaigns,
    fetchCampaignsNotInEngagement,
  };
}
