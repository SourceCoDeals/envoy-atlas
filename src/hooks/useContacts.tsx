import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { logger } from '@/lib/logger';
export type ContactStatus = 'new' | 'contacted' | 'interested' | 'meeting_set' | 'disqualified' | 'do_not_contact';

export interface Contact {
  id: string;
  engagement_id: string;
  company_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  phone: string | null;
  phone_number: string | null; // Backward compat alias
  mobile: string | null;
  linkedin_url: string | null;
  seniority_level: string | null;
  department: string | null;
  company: string | null; // Denormalized for display
  industry: string | null;
  location: string | null;
  contact_status: ContactStatus;
  seller_interest_score: number | null;
  seller_interest_summary: string | null;
  tags: string[];
  do_not_call: boolean;
  do_not_email: boolean;
  do_not_contact: boolean;
  last_contacted_at: string | null;
  last_contact_at: string | null; // Alias
  last_responded_at: string | null;
  total_emails_sent: number;
  total_emails_opened: number;
  total_emails_replied: number;
  total_calls: number;
  total_conversations: number;
  created_at: string;
}

export interface ContactEngagement {
  contact_id: string;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  emails_bounced: number;
  total_calls: number;
  calls_connected: number;
  voicemails_left: number;
  total_talk_time_seconds: number;
  first_contact_date: string | null;
  last_contact_date: string | null;
}

export interface ContactNote {
  id: string;
  contact_id: string;
  created_by: string | null;
  note_text: string;
  note_type: 'manual' | 'system' | 'ai_generated';
  created_at: string;
}

export interface ContactFilters {
  search?: string;
  hasPhone?: boolean;
  hasEmailActivity?: boolean;
  hasCallActivity?: boolean;
}

export function useContacts(filters: ContactFilters = {}) {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchContacts = useCallback(async () => {
    // Wait for workspace to load first
    if (workspaceLoading) return;
    
    if (!currentWorkspace?.id) {
      setContacts([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Get engagement IDs for this client
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setContacts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('contacts')
        .select('*, companies!contacts_company_id_fkey(name, industry, address_city, address_state)', { count: 'exact' })
        .in('engagement_id', engagementIds)
        .order('last_contacted_at', { ascending: false, nullsFirst: false });

      if (filters.search) {
        query = query.or(`email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
      }

      if (filters.hasPhone) {
        query = query.not('phone', 'is', null);
      }

      const { data, error: fetchError, count } = await query.limit(100);

      if (fetchError) throw fetchError;

      setContacts((data || []).map(d => {
        const company = d.companies as { name?: string; industry?: string; address_city?: string; address_state?: string } | null;
        const location = company?.address_city && company?.address_state 
          ? `${company.address_city}, ${company.address_state}` 
          : company?.address_city || company?.address_state || null;
        return {
          ...d,
          phone_number: d.phone,
          company: company?.name || null,
          industry: company?.industry || null,
          location,
          contact_status: 'new' as ContactStatus,
          seller_interest_score: null,
          seller_interest_summary: null,
          tags: [],
          last_contact_at: d.last_contacted_at,
          do_not_call: d.do_not_call || false,
          do_not_email: d.do_not_email || false,
          do_not_contact: d.do_not_contact || false,
          total_emails_sent: d.total_emails_sent || 0,
          total_emails_opened: d.total_emails_opened || 0,
          total_emails_replied: d.total_emails_replied || 0,
          total_calls: d.total_calls || 0,
          total_conversations: d.total_conversations || 0,
        };
      }));
      setTotalCount(count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, workspaceLoading, filters.search, filters.hasPhone]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const updateContact = async (id: string, updates: Partial<Contact>) => {
    const { error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await fetchContacts();
  };

  return {
    contacts,
    loading,
    error,
    totalCount,
    refetch: fetchContacts,
    updateContact,
  };
}

export function useContactDetail(contactId: string | null) {
  const { currentWorkspace } = useWorkspace();
  const [contact, setContact] = useState<Contact | null>(null);
  const [engagement, setEngagement] = useState<ContactEngagement | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContact = useCallback(async () => {
    if (!contactId || !currentWorkspace?.id) {
      setContact(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch contact details
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (contactError) throw contactError;

      setContact({
        id: contactData.id,
        engagement_id: contactData.engagement_id,
        company_id: contactData.company_id,
        email: contactData.email,
        first_name: contactData.first_name,
        last_name: contactData.last_name,
        title: contactData.title,
        phone: contactData.phone,
        phone_number: contactData.phone,
        mobile: contactData.mobile,
        linkedin_url: contactData.linkedin_url,
        seniority_level: contactData.seniority_level,
        department: contactData.department,
        company: null,
        industry: null,
        location: null,
        contact_status: 'new' as ContactStatus,
        seller_interest_score: null,
        seller_interest_summary: null,
        tags: [],
        do_not_call: contactData.do_not_call || false,
        do_not_email: contactData.do_not_email || false,
        do_not_contact: contactData.do_not_contact || false,
        last_contacted_at: contactData.last_contacted_at,
        last_contact_at: contactData.last_contacted_at,
        last_responded_at: contactData.last_responded_at,
        total_emails_sent: contactData.total_emails_sent || 0,
        total_emails_opened: contactData.total_emails_opened || 0,
        total_emails_replied: contactData.total_emails_replied || 0,
        total_calls: contactData.total_calls || 0,
        total_conversations: contactData.total_conversations || 0,
        created_at: contactData.created_at || new Date().toISOString(),
      });

      // Calculate engagement from email_activities and call_activities
      const [emailsResult, callsResult] = await Promise.all([
        supabase
          .from('email_activities')
          .select('sent, opened, clicked, replied, bounced')
          .eq('contact_id', contactId),
        supabase
          .from('call_activities')
          .select('duration_seconds, disposition')
          .eq('contact_id', contactId),
      ]);

      const emails = emailsResult.data || [];
      const calls = callsResult.data || [];

      setEngagement({
        contact_id: contactId,
        emails_sent: emails.filter(e => e.sent).length,
        emails_opened: emails.filter(e => e.opened).length,
        emails_clicked: emails.filter(e => e.clicked).length,
        emails_replied: emails.filter(e => e.replied).length,
        emails_bounced: emails.filter(e => e.bounced).length,
        total_calls: calls.length,
        calls_connected: calls.filter(c => c.disposition === 'connected' || c.disposition === 'conversation').length,
        voicemails_left: calls.filter(c => c.disposition === 'voicemail').length,
        total_talk_time_seconds: calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0),
        first_contact_date: null,
        last_contact_date: null,
      });

      // Fetch notes
      const { data: notesData } = await supabase
        .from('contact_notes')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      setNotes((notesData || []) as ContactNote[]);
    } catch (err) {
      logger.error('Error fetching contact', err);
    } finally {
      setLoading(false);
    }
  }, [contactId, currentWorkspace?.id]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  const addNote = async (noteText: string, noteType: 'manual' | 'system' | 'ai_generated' = 'manual') => {
    if (!contactId || !currentWorkspace?.id) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Get engagement_id from contact
    const { data: contactData } = await supabase
      .from('contacts')
      .select('engagement_id')
      .eq('id', contactId)
      .single();

    if (!contactData) return;

    const { error } = await supabase
      .from('contact_notes')
      .insert({
        engagement_id: contactData.engagement_id,
        contact_id: contactId,
        created_by: userData.user.id,
        note_text: noteText,
        note_type: noteType,
      });

    if (error) throw error;
    await fetchContact();
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;
    await fetchContact();
  };

  return {
    contact,
    engagement,
    notes,
    loading,
    refetch: fetchContact,
    addNote,
    deleteNote,
  };
}

export function useContactTimeline(contactId: string | null) {
  const { currentWorkspace } = useWorkspace();
  const [timeline, setTimeline] = useState<Array<{
    type: 'email' | 'call';
    id: string;
    timestamp: string;
    data: Record<string, unknown>;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTimeline() {
      if (!contactId || !currentWorkspace?.id) {
        setTimeline([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch email activities
        const { data: emailEvents } = await supabase
          .from('email_activities')
          .select('*')
          .eq('contact_id', contactId)
          .order('sent_at', { ascending: false });

        // Fetch call activities
        const { data: callEvents } = await supabase
          .from('call_activities')
          .select('*')
          .eq('contact_id', contactId)
          .order('started_at', { ascending: false });

        // Combine and sort
        const combined = [
          ...(emailEvents || []).map(e => ({
            type: 'email' as const,
            id: e.id,
            timestamp: e.sent_at || e.created_at,
            data: e as Record<string, unknown>,
          })),
          ...(callEvents || []).map(c => ({
            type: 'call' as const,
            id: c.id,
            timestamp: c.started_at || c.created_at,
            data: c as Record<string, unknown>,
          })),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setTimeline(combined);
      } catch (err) {
        logger.error('Error fetching timeline', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [contactId, currentWorkspace?.id]);

  return { timeline, loading };
}
