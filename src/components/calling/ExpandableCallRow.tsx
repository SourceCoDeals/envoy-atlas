import { useState } from 'react';
import { ColdCall } from '@/hooks/useColdCallAnalytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { AudioPlayer } from './AudioPlayer';
import { ScoreBreakdownPanel } from './ScoreBreakdownPanel';
import { calculateScoreBreakdown, getEnhancedScoreStatus, formatEnhancedScore, ScoreBreakdown } from '@/lib/callScoring';
import { formatCallingDuration } from '@/lib/callingConfig';
import { 
  ChevronDown, 
  ChevronUp, 
  Trophy, 
  User, 
  Phone, 
  Clock, 
  Calendar,
  Play,
  FileText,
  MessageSquare,
  Flag,
  Flame,
  Star,
  Building,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Sub-component: Top Call Reason
function TopCallReason({ call, scoreBreakdown }: { call: ColdCall; scoreBreakdown: ScoreBreakdown }) {
  const reasons: string[] = [];
  
  // Determine why this is a top call
  if (call.is_meeting) {
    reasons.push('Meeting successfully set with prospect');
  }
  if ((call.seller_interest_score || 0) >= 7) {
    reasons.push('Hot lead - high seller interest detected');
  }
  if (scoreBreakdown.qualityTotal >= 3.5) {
    reasons.push('Excellent conversation quality score');
  }
  if (scoreBreakdown.outcomeTotal >= 6) {
    reasons.push('Strong outcome metrics achieved');
  }
  if (call.is_connection && (call.call_duration_sec || 0) >= 300) {
    reasons.push('Extended DM conversation (5+ minutes)');
  }
  if ((call.objection_handling_score || 0) >= 8) {
    reasons.push('Excellent objection handling demonstrated');
  }
  if ((call.value_proposition_score || 0) >= 8) {
    reasons.push('Strong value proposition delivery');
  }
  
  // Fallback if no specific reasons
  if (reasons.length === 0) {
    reasons.push('High composite score across multiple dimensions');
  }

  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-primary">
        <Sparkles className="h-4 w-4" />
        Why This Is a Top Call
      </h4>
      <ul className="space-y-1">
        {reasons.map((reason, idx) => (
          <li key={idx} className="text-sm flex items-start gap-2">
            <TrendingUp className="h-3.5 w-3.5 mt-0.5 text-primary/70 flex-shrink-0" />
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Sub-component: Expandable Summary
function ExpandableSummary({ summary }: { summary: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = summary.length > 250;
  const displayText = isLong && !isExpanded ? summary.slice(0, 250) + '...' : summary;

  return (
    <div>
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Star className="h-4 w-4" />
        AI Summary
      </h4>
      <div className="p-3 bg-muted/50 rounded-lg text-sm">
        <p className="leading-relaxed">{displayText}</p>
        {isLong && (
          <Button
            variant="link"
            size="sm"
            className="p-0 h-auto mt-1 text-primary"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </Button>
        )}
      </div>
    </div>
  );
}

interface ExpandableCallRowProps {
  call: ColdCall;
  rank: number;
  onNoteSave?: (callId: string, note: string) => void;
  onFlag?: (callId: string, flagged: boolean, reason?: string) => void;
}

export function ExpandableCallRow({ call, rank, onNoteSave, onFlag }: ExpandableCallRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [noteText, setNoteText] = useState((call as any).rep_notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const scoreBreakdown = calculateScoreBreakdown(call);
  const scoreStatus = getEnhancedScoreStatus(scoreBreakdown.normalizedScore);
  
  const isDmConversation = call.is_connection && call.seller_interest_score !== null;
  const isHotLead = (call.seller_interest_score || 0) >= 7;

  const getRankIcon = () => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-semibold">{rank}</span>;
  };

  const getInterestBadge = () => {
    const score = call.seller_interest_score || 0;
    if (score >= 7) return <Badge className="bg-emerald-500">Interest: Yes</Badge>;
    if (score >= 4) return <Badge variant="secondary">Interest: Maybe</Badge>;
    return <Badge variant="outline">Interest: No</Badge>;
  };

  const handleSaveNote = async () => {
    if (!onNoteSave) return;
    setIsSaving(true);
    try {
      await onNoteSave(call.id, noteText);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        'border rounded-lg transition-all',
        isOpen && 'ring-2 ring-primary/20',
        rank <= 3 && 'bg-accent/30'
      )}>
        {/* Collapsed Header */}
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors text-left">
            {/* Rank */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center border">
              {getRankIcon()}
            </div>

            {/* Call Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{call.to_name || call.to_number || 'Unknown'}</p>
                {isDmConversation && <Badge variant="secondary" className="text-xs">DM</Badge>}
                {call.is_meeting && <Badge className="bg-blue-500 text-xs">Meeting</Badge>}
                {isHotLead && <Flame className="h-4 w-4 text-orange-500" />}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {call.analyst?.split('@')[0] || 'Unknown'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatCallingDuration(call.call_duration_sec)}
                </span>
                {call.called_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(parseISO(call.called_date), 'MMM d, h:mm a')}
                  </span>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="text-right">
              <div className={cn('text-xl font-bold', scoreStatus.color)}>
                {formatEnhancedScore(scoreBreakdown.normalizedScore)}
              </div>
              <p className="text-xs text-muted-foreground">{scoreStatus.label}</p>
            </div>

            {/* Expand Icon */}
            <div className="flex-shrink-0">
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 border-t space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Left Column - Call Details */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Call Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prospect</span>
                      <span className="font-medium">{call.to_name || 'Unknown'}</span>
                    </div>
                    {call.to_company && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Company</span>
                        <span className="font-medium">{call.to_company}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium">{call.to_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rep</span>
                      <span className="font-medium">{call.analyst?.split('@')[0]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Disposition</span>
                      <Badge variant="outline">{call.normalized_category || call.category || 'Unknown'}</Badge>
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  {getInterestBadge()}
                  {call.is_meeting && <Badge className="bg-blue-500">Meeting Set</Badge>}
                  {call.is_connection && <Badge variant="secondary">Connected</Badge>}
                </div>
              </div>

              {/* Center Column - Audio & Transcript */}
              <div className="lg:col-span-2 space-y-4">
                {/* Audio Player */}
                {call.call_recording_url && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Recording
                    </h4>
                    <AudioPlayer src={call.call_recording_url} />
                  </div>
                )}

                {/* Top Call Reason */}
                <TopCallReason call={call} scoreBreakdown={scoreBreakdown} />

                {/* AI Summary - Collapsible */}
                {call.call_summary && (
                  <ExpandableSummary summary={call.call_summary} />
                )}

                {/* Transcript */}
                {call.call_transcript && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Transcript
                    </h4>
                    <ScrollArea className="h-[200px] rounded-lg border p-3">
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {call.call_transcript}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ScoreBreakdownPanel breakdown={scoreBreakdown} />

              {/* Rep Notes */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Rep Notes
                </h4>
                <Textarea
                  placeholder="Add notes about this call..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFlag?.(call.id, !(call as any).flagged_for_review)}
                    className={cn((call as any).flagged_for_review && 'text-amber-600')}
                  >
                    <Flag className="h-4 w-4 mr-1" />
                    {(call as any).flagged_for_review ? 'Flagged' : 'Flag for Review'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={isSaving || noteText === ((call as any).rep_notes || '')}
                  >
                    {isSaving ? 'Saving...' : 'Save Note'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
