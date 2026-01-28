/**
 * MSW (Mock Service Worker) Handlers
 * 
 * Mock API responses for testing
 * Used by vitest setup to intercept network requests
 */
import { http, HttpResponse } from 'msw';

const SUPABASE_URL = 'https://qaedjtdwishtcrfjhmvu.supabase.co';

// Sample data for mocking
const mockEngagements = [
  { 
    id: 'eng-1', 
    name: 'Test Engagement', 
    client_id: 'client-1',
    sponsor_name: 'Acme Capital',
    portfolio_company: 'Widget Corp',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
];

const mockCampaigns = [
  { 
    id: 'camp-1', 
    name: 'Test Campaign',
    engagement_id: 'eng-1',
    status: 'active',
    campaign_type: 'email',
    total_sent: 1000,
    total_delivered: 950,
    total_opened: 500,
    total_replied: 50,
    total_bounced: 50,
    positive_replies: 10,
    total_meetings: 2,
    reply_rate: 0.0526,
    positive_rate: 0.0105,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  },
];

const mockColdCalls = [
  {
    id: 'call-1',
    client_id: 'client-1',
    engagement_id: 'eng-1',
    analyst: 'John Doe',
    called_date: '2026-01-15',
    call_duration_sec: 180,
    composite_score: 7.5,
    enhanced_score: 7.8,
    is_meeting: false,
    is_connection: true,
    is_voicemail: false,
    is_bad_data: false,
    category: 'Conversation',
    normalized_category: 'conversation',
    seller_interest_score: 6,
    decision_maker_identified_score: 7,
    objection_handling_score: 5,
  },
  {
    id: 'call-2',
    client_id: 'client-1',
    engagement_id: 'eng-1',
    analyst: 'Jane Smith',
    called_date: '2026-01-15',
    call_duration_sec: 45,
    composite_score: 4.2,
    is_meeting: false,
    is_connection: false,
    is_voicemail: true,
    is_bad_data: false,
    category: 'Voicemail',
    normalized_category: 'voicemail',
  },
];

const mockDailyMetrics = [
  {
    id: 'dm-1',
    engagement_id: 'eng-1',
    date: '2026-01-15',
    emails_sent: 100,
    emails_delivered: 95,
    emails_opened: 50,
    emails_replied: 5,
    emails_bounced: 5,
    positive_replies: 1,
  },
];

export const handlers = [
  // Engagements
  http.get(`${SUPABASE_URL}/rest/v1/engagements*`, () => {
    return HttpResponse.json(mockEngagements);
  }),

  // Campaigns
  http.get(`${SUPABASE_URL}/rest/v1/campaigns*`, () => {
    return HttpResponse.json(mockCampaigns);
  }),

  // Cold Calls
  http.get(`${SUPABASE_URL}/rest/v1/cold_calls*`, () => {
    return HttpResponse.json(mockColdCalls);
  }),

  // Daily Metrics
  http.get(`${SUPABASE_URL}/rest/v1/daily_metrics*`, () => {
    return HttpResponse.json(mockDailyMetrics);
  }),

  // Sync Progress
  http.get(`${SUPABASE_URL}/rest/v1/sync_progress*`, () => {
    return HttpResponse.json([]);
  }),

  // Sync Retry Queue
  http.get(`${SUPABASE_URL}/rest/v1/sync_retry_queue*`, () => {
    return HttpResponse.json([]);
  }),

  // Generic fallback for other tables
  http.get(`${SUPABASE_URL}/rest/v1/*`, ({ request }) => {
    const url = new URL(request.url);
    console.warn(`[MSW] Unhandled GET request to: ${url.pathname}`);
    return HttpResponse.json([]);
  }),

  // POST handlers for mutations
  http.post(`${SUPABASE_URL}/rest/v1/*`, () => {
    return HttpResponse.json({ success: true });
  }),

  // PATCH handlers for updates
  http.patch(`${SUPABASE_URL}/rest/v1/*`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Edge function handlers
  http.post(`${SUPABASE_URL}/functions/v1/*`, () => {
    return HttpResponse.json({ success: true });
  }),
];

// Export mock data for direct use in tests
export const mockData = {
  engagements: mockEngagements,
  campaigns: mockCampaigns,
  coldCalls: mockColdCalls,
  dailyMetrics: mockDailyMetrics,
};
