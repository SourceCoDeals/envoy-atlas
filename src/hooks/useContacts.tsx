import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

export type ContactStatus = 'new' | 'contacted' | 'interested' | 'meeting_set' | 'disqualified' | 'do_not_contact';

export interface Contact {
  id: string;
  workspace_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  industry: string | null;
  phone_number: string | null;
  location: string | null;
  contact_status: ContactStatus;
  seller_interest_score: number | null;
  seller_interest_summary: string | null;
  assigned_to: string | null;
  tags: string[];
  last_contact_at: string | null;
  last_email_at: string | null;
  last_call_at: string | null;
  next_action_date: string | null;
  next_action_type: string | null;
  do_not_call: boolean;
  do_not_email: boolean;
  created_at: string;
}

export interface ContactEngagement {
  lead_id: string;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  emails_bounced: number;
  total_calls: number;
  calls_connected: number;
  voicemails_left: number;
  total_talk_time_seconds: number;
  avg_ai_score: number;
  first_contact_date: string | null;
  last_contact_date: string | null;
}

export interface ContactNote {
  id: string;
  lead_id: string;
  created_by: string;
  note_text: string;
  note_type: 'manual' | 'system' | 'ai_generated';
  created_at: string;
}

export interface ContactFilters {
  search?: string;
  status?: ContactStatus | 'all';
  hasPhone?: boolean;
  hasEmailActivity?: boolean;
  hasCallActivity?: boolean;
  tags?: string[];
}

export function useContacts(filters: ContactFilters = {}) {
  const { currentWorkspace } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchContacts = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('workspace_id', currentWorkspace.id)
        .order('last_contact_at', { ascending: false, nullsFirst: false });

      if (filters.search) {
        query = query.or(`email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('contact_status', filters.status);
      }

      if (filters.hasPhone) {
        query = query.not('phone_number', 'is', null);
      }

      const { data, error: fetchError, count } = await query.limit(100);

      if (fetchError) throw fetchError;

      setContacts((data || []).map(d => ({
        ...d,
        contact_status: (d.contact_status || 'new') as ContactStatus,
        tags: d.tags || [],
        do_not_call: d.do_not_call || false,
        do_not_email: d.do_not_email || false,
      })));
      setTotalCount(count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, filters.search, filters.status, filters.hasPhone]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const updateContact = async (id: string, updates: Partial<Contact>) => {
    const { error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await fetchContacts();
  };

  const addTag = async (id: string, tag: string) => {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;
    
    const newTags = [...(contact.tags || []), tag];
    await updateContact(id, { tags: newTags });
  };

  const removeTag = async (id: string, tag: string) => {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;
    
    const newTags = (contact.tags || []).filter(t => t !== tag);
    await updateContact(id, { tags: newTags });
  };

  return {
    contacts,
    loading,
    error,
    totalCount,
    refetch: fetchContacts,
    updateContact,
    addTag,
    removeTag,
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
        .from('leads')
        .select('*')
        .eq('id', contactId)
        .single();

      if (contactError) throw contactError;

      setContact({
        ...contactData,
        contact_status: (contactData.contact_status || 'new') as ContactStatus,
        tags: contactData.tags || [],
        do_not_call: contactData.do_not_call || false,
        do_not_email: contactData.do_not_email || false,
      });

      // Fetch engagement summary from view
      const { data: engagementData } = await supabase
        .from('contact_engagement_summary')
        .select('*')
        .eq('lead_id', contactId)
        .single();

      if (engagementData) {
        setEngagement({
          lead_id: engagementData.lead_id,
          emails_sent: Number(engagementData.emails_sent) || 0,
          emails_opened: Number(engagementData.emails_opened) || 0,
          emails_clicked: Number(engagementData.emails_clicked) || 0,
          emails_replied: Number(engagementData.emails_replied) || 0,
          emails_bounced: Number(engagementData.emails_bounced) || 0,
          total_calls: Number(engagementData.total_calls) || 0,
          calls_connected: Number(engagementData.calls_connected) || 0,
          voicemails_left: Number(engagementData.voicemails_left) || 0,
          total_talk_time_seconds: Number(engagementData.total_talk_time_seconds) || 0,
          avg_ai_score: Number(engagementData.avg_ai_score) || 0,
          first_contact_date: engagementData.first_contact_date,
          last_contact_date: engagementData.last_contact_date,
        });
      }

      // Fetch notes
      const { data: notesData } = await supabase
        .from('contact_notes')
        .select('*')
        .eq('lead_id', contactId)
        .order('created_at', { ascending: false });

      setNotes((notesData || []) as ContactNote[]);
    } catch (err) {
      console.error('Error fetching contact:', err);
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

    const { error } = await supabase
      .from('contact_notes')
      .insert({
        workspace_id: currentWorkspace.id,
        lead_id: contactId,
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
        // Fetch email events
        const { data: emailEvents } = await supabase
          .from('message_events')
          .select('*')
          .eq('lead_id', contactId)
          .order('occurred_at', { ascending: false });

        // Fetch call events
        const { data: callEvents } = await supabase
          .from('phoneburner_calls')
          .select('*, call_ai_scores(*)')
          .eq('contact_id', contactId)
          .order('start_at', { ascending: false });

        // Combine and sort
        const combined = [
          ...(emailEvents || []).map(e => ({
            type: 'email' as const,
            id: e.id,
            timestamp: e.occurred_at,
            data: e as Record<string, unknown>,
          })),
          ...(callEvents || []).map(c => ({
            type: 'call' as const,
            id: c.id,
            timestamp: c.start_at || c.created_at,
            data: c as Record<string, unknown>,
          })),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setTimeline(combined);
      } catch (err) {
        console.error('Error fetching timeline:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [contactId, currentWorkspace?.id]);

  return { timeline, loading };
}
