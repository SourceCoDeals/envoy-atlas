import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ContactFull {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  phone: string | null;
  mobile: string | null;
  company_id: string;
  company_name: string | null;
  company_domain: string | null;
  company_industry: string | null;
  engagement_id: string;
  sequence_status: string | null;
  current_step: number | null;
  linkedin_url: string | null;
  // Aggregated stats
  emails_sent: number;
  emails_opened: number;
  emails_replied: number;
  calls_made: number;
  conversations: number;
  meetings_booked: number;
  last_touch_at: string | null;
  last_touch_type: 'email' | 'call' | null;
}

export interface TimelineActivity {
  id: string;
  type: 'email_sent' | 'email_opened' | 'email_replied' | 'email_clicked' | 'email_bounced' | 'call';
  timestamp: string;
  subject?: string;
  campaign_name?: string;
  step_number?: number;
  reply_text?: string;
  call_duration?: number;
  call_disposition?: string;
  call_notes?: string;
  rep_name?: string;
}

export interface EmailRecord {
  id: string;
  sent_at: string | null;
  subject: string | null;
  campaign_name: string | null;
  step_number: number | null;
  opened: boolean;
  replied: boolean;
  clicked: boolean;
  bounced: boolean;
  first_opened_at: string | null;
  replied_at: string | null;
  reply_text: string | null;
  body_preview: string | null;
}

export interface CallRecord {
  id: string;
  started_at: string | null;
  duration_seconds: number | null;
  disposition: string | null;
  notes: string | null;
  caller_name: string | null;
  recording_url: string | null;
  transcription: string | null;
}

export function useContactDetailFull(contactId: string | undefined) {
  const [contact, setContact] = useState<ContactFull | null>(null);
  const [timeline, setTimeline] = useState<TimelineActivity[]>([]);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContactDetail = useCallback(async () => {
    if (!contactId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // Fetch contact with company
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select(`
          *,
          company:companies(name, domain, website, industry, employee_count)
        `)
        .eq('id', contactId)
        .single();

      if (contactError || !contactData) {
        setLoading(false);
        return;
      }

      // Fetch email activities
      const { data: emailData } = await supabase
        .from('email_activities')
        .select(`
          id, sent_at, opened, replied, clicked, bounced,
          first_opened_at, replied_at, reply_text, body_preview, step_number,
          variant:campaign_variants(subject_line, step_number),
          campaign:campaigns(name)
        `)
        .eq('contact_id', contactId)
        .order('sent_at', { ascending: false });

      // Fetch calls
      const { data: callData } = await supabase
        .from('call_activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('started_at', { ascending: false });

      // Build aggregated contact object
      const emailsSent = emailData?.length || 0;
      const emailsOpened = emailData?.filter(e => e.opened).length || 0;
      const emailsReplied = emailData?.filter(e => e.replied).length || 0;
      const callsMade = callData?.length || 0;
      const conversations = callData?.filter(c => 
        ['dm_conversation', 'meeting_booked', 'conversation', 'connected'].includes(c.disposition || '')
      ).length || 0;
      const meetingsBooked = callData?.filter(c => c.disposition === 'meeting_booked').length || 0;

      const company = contactData.company as { name?: string; domain?: string; industry?: string } | null;

      setContact({
        id: contactData.id,
        email: contactData.email,
        first_name: contactData.first_name,
        last_name: contactData.last_name,
        title: contactData.title,
        phone: contactData.phone,
        mobile: contactData.mobile,
        company_id: contactData.company_id,
        company_name: company?.name || null,
        company_domain: company?.domain || null,
        company_industry: company?.industry || null,
        engagement_id: contactData.engagement_id,
        sequence_status: contactData.sequence_status,
        current_step: contactData.current_step,
        linkedin_url: contactData.linkedin_url,
        emails_sent: emailsSent,
        emails_opened: emailsOpened,
        emails_replied: emailsReplied,
        calls_made: callsMade,
        conversations,
        meetings_booked: meetingsBooked,
        last_touch_at: emailData?.[0]?.sent_at || callData?.[0]?.started_at || null,
        last_touch_type: emailData?.[0]?.sent_at && callData?.[0]?.started_at
          ? new Date(emailData[0].sent_at) > new Date(callData[0].started_at) ? 'email' : 'call'
          : emailData?.[0]?.sent_at ? 'email' : callData?.[0]?.started_at ? 'call' : null,
      });

      // Map emails
      setEmails((emailData || []).map(e => {
        const variant = e.variant as { subject_line?: string; step_number?: number } | null;
        const campaign = e.campaign as { name?: string } | null;
        return {
          id: e.id,
          sent_at: e.sent_at,
          subject: variant?.subject_line || null,
          campaign_name: campaign?.name || null,
          step_number: variant?.step_number || e.step_number,
          opened: e.opened || false,
          replied: e.replied || false,
          clicked: e.clicked || false,
          bounced: e.bounced || false,
          first_opened_at: e.first_opened_at,
          replied_at: e.replied_at,
          reply_text: e.reply_text,
          body_preview: e.body_preview,
        };
      }));

      // Map calls
      setCalls((callData || []).map(c => ({
        id: c.id,
        started_at: c.started_at,
        duration_seconds: c.duration_seconds,
        disposition: c.disposition,
        notes: c.notes,
        caller_name: c.caller_name,
        recording_url: c.recording_url,
        transcription: c.transcription,
      })));

      // Build unified timeline
      const timelineItems: TimelineActivity[] = [];

      // Add email events
      for (const email of (emailData || [])) {
        const variant = email.variant as { subject_line?: string; step_number?: number } | null;
        const campaign = email.campaign as { name?: string } | null;

        if (email.sent_at) {
          timelineItems.push({
            id: `email-sent-${email.id}`,
            type: 'email_sent',
            timestamp: email.sent_at,
            subject: variant?.subject_line,
            campaign_name: campaign?.name,
            step_number: variant?.step_number || email.step_number,
          });
        }

        if (email.opened && email.first_opened_at) {
          timelineItems.push({
            id: `email-opened-${email.id}`,
            type: 'email_opened',
            timestamp: email.first_opened_at,
            subject: variant?.subject_line,
          });
        }

        if (email.replied && email.replied_at) {
          timelineItems.push({
            id: `email-replied-${email.id}`,
            type: 'email_replied',
            timestamp: email.replied_at,
            subject: variant?.subject_line,
            reply_text: email.reply_text,
          });
        }

        if (email.clicked) {
          timelineItems.push({
            id: `email-clicked-${email.id}`,
            type: 'email_clicked',
            timestamp: email.first_opened_at || email.sent_at || '',
            subject: variant?.subject_line,
          });
        }

        if (email.bounced) {
          timelineItems.push({
            id: `email-bounced-${email.id}`,
            type: 'email_bounced',
            timestamp: email.sent_at || '',
            subject: variant?.subject_line,
          });
        }
      }

      // Add call events
      for (const call of (callData || [])) {
        if (call.started_at) {
          timelineItems.push({
            id: `call-${call.id}`,
            type: 'call',
            timestamp: call.started_at,
            call_duration: call.duration_seconds,
            call_disposition: call.disposition,
            call_notes: call.notes,
            rep_name: call.caller_name,
          });
        }
      }

      // Sort by timestamp descending
      timelineItems.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setTimeline(timelineItems);

    } catch (err) {
      console.error('Error fetching contact detail:', err);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchContactDetail();
  }, [fetchContactDetail]);

  return {
    contact,
    timeline,
    emails,
    calls,
    loading,
    refetch: fetchContactDetail,
  };
}