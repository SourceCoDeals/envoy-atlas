import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  ExternalLink, 
  Linkedin, 
  Mail, 
  Building2, 
  MapPin,
  CheckCircle,
  Clock,
  Send,
  Calendar,
  Paperclip,
  Link2,
  FileText,
  Star,
} from 'lucide-react';
import { format } from 'date-fns';
import { CLASSIFICATION_CONFIG, type ReplyClassification, type PriorityLevel } from '@/lib/replyClassification';

interface ThreadMessage {
  id: string;
  sender: 'you' | 'lead';
  senderName: string;
  content: string;
  timestamp: string;
  isLatest: boolean;
}

interface InboxItem {
  id: string;
  lead_email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  campaign_name: string;
  reply_content: string | null;
  classification: ReplyClassification;
  priority: PriorityLevel;
  occurred_at: string;
  isOverdue: boolean;
  isICP: boolean;
  companySize?: string;
  industry?: string;
  location?: string;
}

interface ResponseSuggestion {
  id: string;
  name: string;
  preview: string;
  fullText: string;
  isRecommended: boolean;
  stats?: {
    meetingRate: number;
    usageCount: number;
  };
}

interface InboxDetailPanelProps {
  item: InboxItem | null;
  onClose: () => void;
}

export function InboxDetailPanel({ item, onClose }: InboxDetailPanelProps) {
  const [replyText, setReplyText] = useState('');
  
  if (!item) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-12">
          <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Select a reply to view details</p>
        </CardContent>
      </Card>
    );
  }

  const config = CLASSIFICATION_CONFIG[item.classification];

  // Mock thread data
  const thread: ThreadMessage[] = [
    {
      id: '1',
      sender: 'you',
      senderName: 'You',
      content: `Hi ${item.first_name},\n\nI noticed ${item.company || 'your company'} has been scaling quickly. As you grow the team, how are you handling the outbound process?\n\nBest,\n[Your name]`,
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      isLatest: false,
    },
    {
      id: '2',
      sender: 'lead',
      senderName: `${item.first_name} ${item.last_name || ''}`,
      content: item.reply_content || 'No reply content',
      timestamp: item.occurred_at,
      isLatest: true,
    },
  ];

  // Mock suggestions based on classification
  const suggestions: ResponseSuggestion[] = [
    {
      id: '1',
      name: item.classification === 'meeting_request' ? 'Send Calendar Link' : 'Interest Follow-up',
      preview: `Hi ${item.first_name},\n\nThanks for your response! Here's my calendar link to grab a time that works for you: [calendar_link]\n\nLooking forward to chatting!\n\nBest,\n[Your name]`,
      fullText: `Hi ${item.first_name},\n\nThanks for your response! Here's my calendar link to grab a time that works for you: [calendar_link]\n\nLooking forward to chatting!\n\nBest,\n[Your name]`,
      isRecommended: true,
      stats: {
        meetingRate: 68,
        usageCount: 142,
      },
    },
    {
      id: '2',
      name: 'Propose Specific Times',
      preview: `Hi ${item.first_name},\n\nGreat! Would Thursday 2pm or 3pm PT work for a quick 15-minute call?\n\nBest,\n[Your name]`,
      fullText: `Hi ${item.first_name},\n\nGreat! Would Thursday 2pm or 3pm PT work for a quick 15-minute call?\n\nBest,\n[Your name]`,
      isRecommended: false,
    },
  ];

  const handleUseSuggestion = (suggestion: ResponseSuggestion) => {
    setReplyText(suggestion.fullText);
  };

  const signalPhrases = {
    meeting_request: ['Time availability mentioned', 'Meeting language detected', 'Interest confirmed'],
    interested: ['Interest signals detected', 'Asking for more info'],
    question: ['Question detected', 'Seeking clarification'],
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Conversation</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4">
          {/* Contact Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold">{item.first_name} {item.last_name || ''}</h3>
                <p className="text-sm text-muted-foreground">{item.title}</p>
              </div>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3 w-3 mr-1" />
                View in CRM
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {item.company || 'Unknown'} {item.companySize && `• ${item.companySize}`}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3 w-3" />
                {item.lead_email}
              </div>
              {item.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {item.location}
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Linkedin className="h-3 w-3" />
                LinkedIn Profile
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              {item.isICP && (
                <Badge variant="outline" className="text-success border-success/30">
                  ICP Match
                </Badge>
              )}
              <Badge variant="outline">Decision Maker</Badge>
              {thread.length > 1 && (
                <Badge variant="outline">Previous Engagement</Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Thread */}
          <div>
            <h4 className="text-sm font-medium mb-3">Thread</h4>
            <div className="space-y-4">
              {thread.map(msg => (
                <div key={msg.id} className="border-l-2 border-muted pl-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {msg.senderName.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.timestamp), 'MMM d, h:mm a')}
                      </span>
                      {msg.isLatest && (
                        <Badge variant="outline" className="text-xs">← LATEST</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Classification */}
          <div>
            <h4 className="text-sm font-medium mb-3">Classification</h4>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Intent: <strong>{config.label.toUpperCase()}</strong>
                </span>
                <Badge variant="outline">92% confidence</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Priority: <strong className={config.textClass}>{item.priority} — HOT</strong>
                </span>
              </div>
              <div className="space-y-1 mt-2">
                <p className="text-xs text-muted-foreground">Signals detected:</p>
                {(signalPhrases[item.classification as keyof typeof signalPhrases] || ['General response']).map((signal, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-success" />
                    {signal}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Suggested Responses */}
          <div>
            <h4 className="text-sm font-medium mb-3">Suggested Responses</h4>
            <div className="space-y-3">
              {suggestions.map(suggestion => (
                <div 
                  key={suggestion.id} 
                  className={`border rounded-lg p-3 ${suggestion.isRecommended ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {suggestion.isRecommended && (
                      <Star className="h-4 w-4 text-primary fill-primary" />
                    )}
                    <span className="font-medium text-sm">
                      {suggestion.isRecommended ? 'RECOMMENDED: ' : ''}{suggestion.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap mb-2 line-clamp-4">
                    {suggestion.preview}
                  </p>
                  {suggestion.stats && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Template: "{suggestion.name}" • {suggestion.stats.meetingRate}% meeting rate • Used {suggestion.stats.usageCount}x
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleUseSuggestion(suggestion)}>
                      Use This Response
                    </Button>
                    <Button variant="outline" size="sm">
                      Edit First
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Compose Reply */}
          <div>
            <h4 className="text-sm font-medium mb-3">Compose Reply</h4>
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <p>To: {item.lead_email}</p>
                <p>Subject: Re: {item.campaign_name}</p>
              </div>
              <Textarea
                placeholder="Write your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[120px]"
              />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Link2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Calendar className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <FileText className="h-4 w-4" />
                </Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm">
                  Save Draft
                </Button>
                <Button size="sm">
                  <Send className="h-4 w-4 mr-1" />
                  Send Reply
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
