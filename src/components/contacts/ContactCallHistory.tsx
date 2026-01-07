import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Phone, PhoneCall, Voicemail, Clock, Star, ChevronDown, Play, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Call {
  id: string;
  start_at: string | null;
  duration_seconds: number | null;
  is_connected: boolean | null;
  is_voicemail: boolean | null;
  disposition: string | null;
  recording_url: string | null;
  notes: string | null;
  call_ai_scores: Array<{
    composite_score: number | null;
    seller_interest_score: number | null;
    seller_interest_justification: string | null;
    objections_list: unknown;
    engagement_score: number | null;
    rapport_building_score: number | null;
  }>;
  call_transcripts: Array<{
    transcript_text: string | null;
    transcription_status: string;
  }>;
}

interface ContactCallHistoryProps {
  contactId: string | null;
}

export function ContactCallHistory({ contactId }: ContactCallHistoryProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCalls() {
      if (!contactId) {
        setCalls([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data } = await supabase
        .from('phoneburner_calls')
        .select('*, call_ai_scores(*), call_transcripts(*)')
        .eq('contact_id', contactId)
        .order('start_at', { ascending: false });

      setCalls((data || []) as Call[]);
      setLoading(false);
    }

    fetchCalls();
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No call history
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {calls.map((call) => {
        const aiScore = call.call_ai_scores?.[0];
        const transcript = call.call_transcripts?.[0];

        return (
          <Card key={call.id}>
            <CardContent className="pt-4">
              <Collapsible>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      call.is_connected ? 'bg-green-500/10 text-green-500' :
                      call.is_voicemail ? 'bg-orange-500/10 text-orange-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {call.is_connected ? <PhoneCall className="h-5 w-5" /> :
                       call.is_voicemail ? <Voicemail className="h-5 w-5" /> :
                       <Phone className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="font-medium">
                        {call.is_connected ? 'Connected Call' :
                         call.is_voicemail ? 'Voicemail Left' :
                         call.disposition || 'No Answer'}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {call.start_at && (
                          <span>{format(new Date(call.start_at), 'MMM d, yyyy h:mm a')}</span>
                        )}
                        {call.duration_seconds && call.duration_seconds > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {aiScore?.composite_score && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {aiScore.composite_score}/100
                      </Badge>
                    )}
                    {call.recording_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                          <Play className="h-3 w-3 mr-1" />
                          Listen
                        </a>
                      </Button>
                    )}
                    {(aiScore || transcript) && (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="mt-4 space-y-4">
                    {/* AI Scores */}
                    {aiScore && (
                      <div className="grid grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg">
                        {aiScore.seller_interest_score && (
                          <div className="text-center">
                            <div className="text-lg font-bold">{aiScore.seller_interest_score}</div>
                            <div className="text-xs text-muted-foreground">Seller Interest</div>
                          </div>
                        )}
                        {aiScore.engagement_score && (
                          <div className="text-center">
                            <div className="text-lg font-bold">{aiScore.engagement_score}</div>
                            <div className="text-xs text-muted-foreground">Engagement</div>
                          </div>
                        )}
                        {aiScore.rapport_building_score && (
                          <div className="text-center">
                            <div className="text-lg font-bold">{aiScore.rapport_building_score}</div>
                            <div className="text-xs text-muted-foreground">Rapport</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Objections */}
                    {aiScore?.objections_list && Array.isArray(aiScore.objections_list) && aiScore.objections_list.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Objections</h4>
                        <div className="flex flex-wrap gap-2">
                          {(aiScore.objections_list as string[]).map((obj, i) => (
                            <Badge key={i} variant="outline">{obj}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {call.notes && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{call.notes}</p>
                      </div>
                    )}

                    {/* Transcript */}
                    {transcript?.transcript_text && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Transcript
                        </h4>
                        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {transcript.transcript_text.substring(0, 1000)}
                          {transcript.transcript_text.length > 1000 && '...'}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
