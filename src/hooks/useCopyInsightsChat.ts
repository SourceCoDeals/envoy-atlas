import { useState, useCallback, useMemo } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QueryContext {
  currentPage: string;
  activeFilters?: Record<string, string>;
  selectedCampaignId?: string;
  timeRange?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copy-insights-chat`;

// Page-specific suggested prompts - trained on State of Cold Calling 2025
const PAGE_SUGGESTIONS: Record<string, string[]> = {
  'dashboard': [
    "Give me a performance summary vs 2025 benchmarks",
    "What needs my attention today?",
    "How are we trending vs industry averages?",
    "What's our biggest opportunity right now?",
  ],
  'campaigns': [
    "Which campaigns should I scale?",
    "What's wrong with underperforming campaigns?",
    "Rank my campaigns by performance",
    "Which campaigns need attention?",
  ],
  'copy-insights': [
    "What subject lines work best?",
    "What's the optimal email length?",
    "What CTA drives the most meetings?",
    "Are any templates burning out?",
    "Generate 3 new subject line variants",
  ],
  'audience': [
    "Which segment performs best?",
    "Is our ICP validated?",
    "Any segments showing fatigue?",
    "Where should I focus my volume?",
  ],
  'deliverability': [
    "Is it safe to send right now?",
    "What's my deliverability risk?",
    "Any domain authentication issues?",
    "Which mailbox has problems?",
  ],
  'experiments': [
    "What experiments are running?",
    "What should I test next?",
    "Did we find any winners?",
    "How long until results are ready?",
  ],
  'inbox': [
    "Any hot leads right now?",
    "What should I respond to first?",
    "How many positive replies today?",
    "Show me meeting requests",
  ],
  // Cold Calling specific pages
  'calling/ai-summary': [
    "What's our connect rate vs 2025 benchmark?",
    "Which objections are we struggling with?",
    "How does our call duration compare to optimal?",
    "What gatekeeper techniques work best?",
    "Are reps talking too much on calls?",
  ],
  'calling/caller-dashboard': [
    "What's my connect rate vs 25-35% benchmark?",
    "Am I calling at the best times?",
    "How many attempts are we making per prospect?",
    "What's our gatekeeper transfer rate?",
    "How do I compare to top performers (6.7% success)?",
  ],
  'calling/data-insights': [
    "Is our data quality causing issues?",
    "What's our wrong number rate?",
    "How does our connect rate compare to benchmark?",
    "Are we reaching prospects by the 3rd attempt?",
    "What's our data decay rate?",
  ],
  'calling/call-analytics': [
    "What's our average call duration vs 93 sec benchmark?",
    "Are reps asking 11-14 questions per call?",
    "What's our objection handling success rate?",
    "How effective is our opening line?",
    "What call patterns lead to meetings?",
  ],
  'default': [
    "What's my reply rate vs 2025 benchmarks?",
    "Which campaigns are performing best?",
    "What objection handling techniques should I use?",
    "What should I focus on this week?",
    "Give me actionable recommendations",
    "How do I navigate gatekeepers better?",
  ],
};

export function useCopyInsightsChat() {
  const { currentWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  // Derive current page from location
  const currentPage = useMemo(() => {
    const path = location.pathname.replace('/', '') || 'dashboard';
    return path;
  }, [location.pathname]);

  // Get page-specific suggestions
  const suggestedPrompts = useMemo(() => {
    return PAGE_SUGGESTIONS[currentPage] || PAGE_SUGGESTIONS['default'];
  }, [currentPage]);

  // Build context from current state
  const getContext = useCallback((): QueryContext => {
    return {
      currentPage,
      // Could be extended to include filters, selected campaigns, etc.
    };
  }, [currentPage]);

  const sendMessage = useCallback(async (content: string) => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    let assistantContent = '';
    const assistantId = crypto.randomUUID();

    const upsertAssistant = (nextChunk: string) => {
      assistantContent += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === assistantId) {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, {
          id: assistantId,
          role: 'assistant' as const,
          content: assistantContent,
          timestamp: new Date(),
        }];
      });
    };

    try {
      const allMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Get user's JWT token for proper authorization
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          workspaceId: currentWorkspace.id,
          context: getContext(),
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (resp.status === 402) {
          throw new Error('AI credits exhausted. Add credits in Settings → Workspace → Usage.');
        }
        throw new Error(errorData.error || `Request failed with status ${resp.status}`);
      }

      if (!resp.body) {
        throw new Error('No response body');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      // Remove the user message if we failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, messages, getContext]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    suggestedPrompts,
    currentPage,
  };
}
