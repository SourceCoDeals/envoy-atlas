import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  Loader2, 
  Mail, 
  ExternalLink, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  Send,
  Reply as ReplyIcon,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageHistoryItem {
  id: number;
  type: string;
  time: string;
  date?: string;
  email_body?: string;
  email_subject?: string;
  subject?: string;
  body?: string;
  seq_number?: number;
  stepNumber?: number;
}

interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  hasReply: boolean;
  messageHistory: MessageHistoryItem[];
  platformUrl: string;
}

interface SmartleadResult {
  platform: 'smartlead';
  lead: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
    company_name?: string;
  };
  campaigns: SmartleadCampaign[];
}

interface ReplyioSequence {
  id: number;
  name: string;
  status: string;
  hasReply: boolean;
  emails: MessageHistoryItem[];
  platformUrl: string;
}

interface ReplyioResult {
  platform: 'replyio';
  contact: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  };
  sequences: ReplyioSequence[];
}

interface SearchResults {
  success: boolean;
  email: string;
  smartlead: SmartleadResult | null;
  replyio: ReplyioResult | null;
  hasSmartleadConnection: boolean;
  hasReplyioConnection: boolean;
}

function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  
  if (trimmed.includes(' ')) {
    return { valid: false, error: 'Email contains spaces. Please remove them.' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  
  return { valid: true };
}

function MessageThread({ messages, platform }: { messages: MessageHistoryItem[]; platform: 'smartlead' | 'replyio' }) {
  // Sort by time
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.time || a.date || 0).getTime();
    const timeB = new Date(b.time || b.date || 0).getTime();
    return timeA - timeB;
  });

  if (sortedMessages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No messages found</p>
    );
  }

  return (
    <div className="space-y-3">
      {sortedMessages.map((msg, idx) => {
        const isSent = msg.type === 'SENT' || msg.type === 'sent';
        const messageTime = msg.time || msg.date;
        const subject = msg.email_subject || msg.subject;
        const body = msg.email_body || msg.body || '';
        
        return (
          <div 
            key={msg.id || idx}
            className={cn(
              "p-3 rounded-lg border",
              isSent 
                ? "bg-muted/50 border-border ml-4" 
                : "bg-primary/5 border-primary/20 mr-4"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              {isSent ? (
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ReplyIcon className="h-3.5 w-3.5 text-primary" />
              )}
              <span className="text-xs font-medium">
                {isSent ? 'Sent' : 'Reply'}
              </span>
              {messageTime && (
                <span className="text-xs text-muted-foreground">
                  {new Date(messageTime).toLocaleString()}
                </span>
              )}
              {(msg.seq_number || msg.stepNumber) && (
                <Badge variant="secondary" className="text-xs">
                  Step {msg.seq_number || msg.stepNumber}
                </Badge>
              )}
            </div>
            {subject && (
              <p className="text-sm font-medium mb-1">{subject}</p>
            )}
            <div 
              className="text-sm text-muted-foreground prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </div>
        );
      })}
    </div>
  );
}

function CampaignCard({ 
  campaign, 
  type 
}: { 
  campaign: SmartleadCampaign | ReplyioSequence;
  type: 'smartlead' | 'replyio';
}) {
  const [isOpen, setIsOpen] = useState(campaign.hasReply);
  
  const messages = type === 'smartlead' 
    ? (campaign as SmartleadCampaign).messageHistory 
    : (campaign as ReplyioSequence).emails;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{campaign.name}</span>
                  {campaign.hasReply && (
                    <Badge variant="default" className="bg-green-500">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Replied
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {campaign.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={campaign.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 hover:bg-muted rounded-md"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="p-4 bg-muted/20">
            <ScrollArea className="max-h-[400px]">
              <MessageThread messages={messages} platform={type} />
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function SmartleadSection({ result }: { result: SmartleadResult }) {
  const replyCampaigns = result.campaigns.filter(c => c.hasReply);
  const otherCampaigns = result.campaigns.filter(c => !c.hasReply);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md flex items-center justify-center">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">SmartLead</CardTitle>
              <CardDescription>
                {result.lead.first_name} {result.lead.last_name}
                {result.lead.company_name && ` • ${result.lead.company_name}`}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary">
            {result.campaigns.length} campaign{result.campaigns.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Contact found but not enrolled in any campaigns
          </p>
        ) : (
          <>
            {replyCampaigns.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Campaigns with Replies
                </p>
                {replyCampaigns.map(campaign => (
                  <CampaignCard 
                    key={campaign.id} 
                    campaign={campaign} 
                    type="smartlead" 
                  />
                ))}
              </div>
            )}
            {otherCampaigns.length > 0 && (
              <div className="space-y-2">
                {replyCampaigns.length > 0 && (
                  <p className="text-sm font-medium text-muted-foreground mt-4">
                    Other Campaigns
                  </p>
                )}
                {otherCampaigns.map(campaign => (
                  <CampaignCard 
                    key={campaign.id} 
                    campaign={campaign} 
                    type="smartlead" 
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReplyioSection({ result }: { result: ReplyioResult }) {
  const replySequences = result.sequences.filter(s => s.hasReply);
  const otherSequences = result.sequences.filter(s => !s.hasReply);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-md flex items-center justify-center">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Reply.io</CardTitle>
              <CardDescription>
                {result.contact.firstName} {result.contact.lastName}
                {result.contact.company && ` • ${result.contact.company}`}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary">
            {result.sequences.length} sequence{result.sequences.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.sequences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Contact found but not enrolled in any sequences
          </p>
        ) : (
          <>
            {replySequences.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Sequences with Replies
                </p>
                {replySequences.map(sequence => (
                  <CampaignCard 
                    key={sequence.id} 
                    campaign={sequence} 
                    type="replyio" 
                  />
                ))}
              </div>
            )}
            {otherSequences.length > 0 && (
              <div className="space-y-2">
                {replySequences.length > 0 && (
                  <p className="text-sm font-medium text-muted-foreground mt-4">
                    Other Sequences
                  </p>
                )}
                {otherSequences.map(sequence => (
                  <CampaignCard 
                    key={sequence.id} 
                    campaign={sequence} 
                    type="replyio" 
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ContactsSearch() {
  const { currentWorkspace } = useWorkspace();
  const [email, setEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const validation = validateEmail(email);
    if (!validation.valid) {
      setError(validation.error || 'Invalid email');
      return;
    }
    
    if (!currentWorkspace) {
      setError('No workspace selected');
      return;
    }

    setError(null);
    setResults(null);
    setIsSearching(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('contact-search', {
        body: {
          workspace_id: currentWorkspace.id,
          email: email.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Search failed');
      }

      setResults(response.data);
      
      if (!response.data.smartlead && !response.data.replyio) {
        toast.info('No results found for this email');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const hasNoResults = results && !results.smartlead && !results.replyio;
  const hasResults = results && (results.smartlead || results.replyio);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contact Search</h1>
          <p className="text-muted-foreground">
            Search for a contact across SmartLead and Reply.io to view all their conversations and campaigns
          </p>
        </div>

        {/* Search Box */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search by Email</CardTitle>
            <CardDescription>
              Enter a valid email address to search across all connected platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="Enter email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !email.trim()}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
            
            {error && (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Connection Status */}
        {results && (
          <div className="flex gap-2 flex-wrap">
            {results.hasSmartleadConnection ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                SmartLead Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                SmartLead Not Connected
              </Badge>
            )}
            {results.hasReplyioConnection ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Reply.io Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Reply.io Not Connected
              </Badge>
            )}
          </div>
        )}

        {/* No Results */}
        {hasNoResults && (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Results Found</h3>
              <p className="text-muted-foreground">
                No contact found for <span className="font-medium">{results.email}</span> in connected platforms
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {hasResults && (
          <div className="space-y-4">
            {results.smartlead && (
              <SmartleadSection result={results.smartlead} />
            )}
            
            {results.replyio && (
              <ReplyioSection result={results.replyio} />
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
