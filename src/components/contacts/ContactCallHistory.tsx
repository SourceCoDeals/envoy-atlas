import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Phone, PhoneCall, Voicemail, Clock, ChevronDown, Play, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Call {
  id: string;
  started_at: string | null;
  duration_seconds: number | null;
  disposition: string | null;
  recording_url: string | null;
  notes: string | null;
  transcription: string | null;
  voicemail_left: boolean | null;
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
      const { data, error } = await supabase
        .from('call_activities')
        .select('id, started_at, duration_seconds, disposition, recording_url, notes, transcription, voicemail_left')
        .eq('contact_id', contactId)
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Error fetching call history:', error);
        setCalls([]);
      } else {
        setCalls((data || []) as Call[]);
      }
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
        const isConnected = call.disposition === 'connected' || call.disposition === 'conversation';
        const isVoicemail = call.voicemail_left === true;

        return (
          <Card key={call.id}>
            <CardContent className="pt-4">
              <Collapsible>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isConnected ? 'bg-green-500/10 text-green-500' :
                      isVoicemail ? 'bg-orange-500/10 text-orange-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {isConnected ? <PhoneCall className="h-5 w-5" /> :
                       isVoicemail ? <Voicemail className="h-5 w-5" /> :
                       <Phone className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="font-medium">
                        {isConnected ? 'Connected Call' :
                         isVoicemail ? 'Voicemail Left' :
                         call.disposition || 'No Answer'}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {call.started_at && (
                          <span>{format(new Date(call.started_at), 'MMM d, yyyy h:mm a')}</span>
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
                    {call.recording_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                          <Play className="h-3 w-3 mr-1" />
                          Listen
                        </a>
                      </Button>
                    )}
                    {(call.notes || call.transcription) && (
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
                    {/* Notes */}
                    {call.notes && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{call.notes}</p>
                      </div>
                    )}

                    {/* Transcript */}
                    {call.transcription && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Transcript
                        </h4>
                        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {call.transcription.substring(0, 1000)}
                          {call.transcription.length > 1000 && '...'}
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
