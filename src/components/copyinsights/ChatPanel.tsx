import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Trash2, Loader2, Sparkles, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { useCopyInsightsChat } from '@/hooks/useCopyInsightsChat';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const WELCOME_MESSAGES: Record<string, { title: string; description: string }> = {
  'dashboard': {
    title: 'Your Analytics Assistant',
    description: "Ask me anything about your outbound performance. I can show you metrics, diagnose issues, and recommend improvements.",
  },
  'campaigns': {
    title: 'Campaign Intelligence',
    description: "I can help you understand which campaigns are performing, why, and what to do next.",
  },
  'copy-insights': {
    title: 'Copy Performance Expert',
    description: "Ask me about subject lines, body copy, patterns that work, and how to optimize your messaging.",
  },
  'audience': {
    title: 'Audience Insights',
    description: "I can analyze which segments respond best and help you optimize your targeting.",
  },
  'deliverability': {
    title: 'Deliverability Guardian',
    description: "Let me check your sending health, authentication status, and identify any risks.",
  },
  'experiments': {
    title: 'Experiment Analyst',
    description: "I can help you understand your A/B tests, check significance, and suggest what to test next.",
  },
  'default': {
    title: 'Cold Compass AI',
    description: "Your analytics assistant. Ask me anything about your cold email performance.",
  },
};

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage, clearMessages, suggestedPrompts, currentPage } = useCopyInsightsChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const welcomeContent = WELCOME_MESSAGES[currentPage] || WELCOME_MESSAGES['default'];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleSuggestedPrompt = (prompt: string) => {
    if (isLoading) return;
    sendMessage(prompt);
  };

  // Follow-up suggestions based on last message
  const getFollowUpSuggestions = (): string[] => {
    if (messages.length === 0) return [];
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return [];

    // Basic follow-up suggestions
    const content = lastAssistant.content.toLowerCase();
    const suggestions: string[] = [];

    if (content.includes('reply rate') || content.includes('performance')) {
      suggestions.push("Why is that?", "How can I improve it?");
    }
    if (content.includes('campaign')) {
      suggestions.push("Tell me more", "Compare to others");
    }
    if (content.includes('recommend') || content.includes('suggest')) {
      suggestions.push("What's the impact?", "How do I implement this?");
    }
    if (content.includes('experiment') || content.includes('test')) {
      suggestions.push("How long until results?", "What's the expected lift?");
    }

    return suggestions.slice(0, 3);
  };

  const followUpSuggestions = getFollowUpSuggestions();

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-14 px-4 rounded-full shadow-lg flex items-center gap-2"
        >
          <Sparkles className="h-5 w-5" />
          <span className="font-medium">Cold Compass AI</span>
          {messages.length > 0 && (
            <Badge variant="secondary" className="ml-1">{messages.length}</Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[420px] h-[650px] bg-background border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm">Cold Compass AI</span>
            <p className="text-xs text-muted-foreground">Analytics Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearMessages}
            disabled={messages.length === 0}
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="space-y-4">
            {/* Welcome message */}
            <div className="text-center py-6">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-1">{welcomeContent.title}</h3>
              <p className="text-sm text-muted-foreground">{welcomeContent.description}</p>
            </div>
            
            {/* Suggested prompts */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try asking</p>
              <div className="space-y-2">
                {suggestedPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="w-full text-left text-sm p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                    disabled={isLoading}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Analyzing your data...</span>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Follow-up suggestions */}
      {followUpSuggestions.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t bg-muted/20">
          <div className="flex flex-wrap gap-2">
            {followUpSuggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSuggestedPrompt(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-accent transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-muted/30">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your performance..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          AI responses are based on your actual workspace data
        </p>
      </form>
    </div>
  );
}
