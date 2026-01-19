import { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  BarChart3,
  Phone,
  Users,
  Target,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  visualizations?: any;
}

const SUGGESTED_QUESTIONS = [
  { icon: Phone, text: 'How many calls did we make last week?', category: 'Call Data' },
  { icon: Users, text: "What's our connect rate for active engagements?", category: 'Performance' },
  { icon: Target, text: 'Who needs coaching this week?', category: 'Team' },
  { icon: TrendingUp, text: 'What do our best calls have in common?', category: 'Patterns' },
  { icon: Clock, text: 'What times are best for reaching manufacturing owners?', category: 'Timing' },
  { icon: BarChart3, text: 'Why did our meeting rate drop last week?', category: 'Analysis' },
];

export default function AIChatbot() {
  const { currentWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Welcome message
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Hi! I'm your calling analytics assistant. I can answer questions about your call data, team performance, and patterns. Try asking me something like \"How many calls did we make last week?\" or \"What objections is Sarah struggling with?\"",
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Simulate AI response (would call edge function in production)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Generate contextual response based on query
      let response = '';
      const lowerInput = input.toLowerCase();

      if (lowerInput.includes('calls') && (lowerInput.includes('last week') || lowerInput.includes('this week'))) {
        response = `Based on your data from the past week:\n\n📞 **Total Calls:** 1,247\n✅ **Connects:** 287 (23% connect rate)\n📅 **Meetings Set:** 14 (4.9% of connects)\n⏱️ **Avg Talk Time:** 4:32\n\nThis is a 12% increase in calls compared to the previous week. Your connect rate is slightly above the team average of 21%.`;
      } else if (lowerInput.includes('connect rate') || lowerInput.includes('engagement')) {
        response = `Here's the connect rate breakdown for active engagements:\n\n🏢 **Blackstone Manufacturing:** 28.3% ⬆️\n🏢 **KKR Healthcare:** 22.1% ➡️\n🏢 **Apollo Retail:** 19.7% ⬇️\n\nThe Blackstone engagement is outperforming due to better list quality. I'd recommend applying the same list sourcing criteria to the Apollo engagement.`;
      } else if (lowerInput.includes('coaching') || lowerInput.includes('needs help')) {
        response = `Based on AI score analysis, these reps would benefit from coaching this week:\n\n1. **Mike Chen** - Objection handling score: 45 (below 60 threshold)\n   → Recommended: Role-play "not interested" scenarios\n\n2. **Emily Davis** - Next step clarity: 52\n   → Recommended: Calendar blocking practice\n\n3. **James Wilson** - Valuation discussion: 38\n   → Recommended: Money talk workshop attendance`;
      } else if (lowerInput.includes('best calls') || lowerInput.includes('common')) {
        response = `Pattern analysis from your top 20 calls reveals:\n\n✨ **Opening:** 85% used permission-based openers\n✨ **Discovery:** Asked about timeline within first 2 mins (90%)\n✨ **Objection:** "That's exactly why I called" reframe (75%)\n✨ **Close:** Offered 2 specific times vs open-ended (80%)\n\nThe strongest correlation with meeting conversion is asking about timeline early. This single factor shows 2.3x higher conversion.`;
      } else if (lowerInput.includes('time') || lowerInput.includes('when')) {
        response = `Optimal calling times for manufacturing owners based on your data:\n\n🌅 **Best Window:** Tuesday-Thursday, 8:00-10:00 AM\n📊 **Connect Rate:** 34% (vs. 21% average)\n\n🌙 **Second Best:** Tuesday-Wednesday, 3:00-4:30 PM\n📊 **Connect Rate:** 28%\n\n⚠️ **Avoid:** Mondays before 10 AM, Fridays after 2 PM`;
      } else if (lowerInput.includes('meeting rate') && lowerInput.includes('drop')) {
        response = `I analyzed last week's metrics and identified the likely cause:\n\n📉 **Meeting rate dropped from 5.2% to 3.8%**\n\n**Root Cause Analysis:**\n1. New rep onboarding (2 new reps with 1.5% meeting rate)\n2. Shift to colder lists in Apollo engagement\n3. 15% increase in "just looking" objections\n\n**Recommendation:** Pair new reps with top performer for shadow sessions. Consider warming Apollo lists with email touches first.`;
      } else {
        response = `I understand you're asking about "${input}". Let me search through your data...\n\nI found relevant information but need more specific parameters. Could you clarify:\n- Time period (e.g., "last week", "this month")\n- Specific engagement or rep (if applicable)\n- Metric you're most interested in\n\nTry rephrasing like: "What's the connect rate for [Rep Name] on the [Engagement] this week?"`;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error getting AI response:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-12rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Analytics Assistant</h1>
            <p className="text-muted-foreground">Ask questions about your calling data in plain English</p>
          </div>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Chat Area */}
          <Card className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="p-3 rounded-lg bg-accent">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about your calling data..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>

          {/* Suggested Questions */}
          <Card className="w-80 flex-shrink-0 hidden lg:flex flex-col">
            <CardHeader>
              <CardTitle className="text-sm">Suggested Questions</CardTitle>
              <CardDescription>Click to try these queries</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS.map((q, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(q.text)}
                    className="w-full text-left p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <q.icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm">{q.text}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {q.category}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
