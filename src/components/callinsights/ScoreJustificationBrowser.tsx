import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  MessageSquare, Search, Headphones, Eye, Quote
} from 'lucide-react';
import { CallInsightsData, ExternalCallIntel } from '@/hooks/useExternalCallIntel';
import { CallingMetricsConfig, formatScore } from '@/lib/callingConfig';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

const SCORE_FIELDS = [
  { key: 'overall_quality', label: 'Overall Quality' },
  { key: 'seller_interest', label: 'Seller Interest' },
  { key: 'script_adherence', label: 'Script Adherence' },
  { key: 'next_steps_clarity', label: 'Next Steps Clarity' },
  { key: 'objection_handling', label: 'Objection Handling' },
  { key: 'valuation_discussion', label: 'Valuation Discussion' },
  { key: 'rapport_building', label: 'Rapport Building' },
  { key: 'value_proposition', label: 'Value Proposition' },
  { key: 'conversation_quality', label: 'Conversation Quality' },
  { key: 'personal_insights', label: 'Personal Insights' },
  { key: 'discovery', label: 'Discovery' },
];

export function ScoreJustificationBrowser({ data, config }: Props) {
  const [selectedScore, setSelectedScore] = useState<string>('overall_quality');
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreRange, setScoreRange] = useState<[number, number]>([1, 10]);
  const [selectedRep, setSelectedRep] = useState<string>('all');

  if (!data) return null;

  // Get unique reps
  const reps = Array.from(new Set(
    data.intelRecords
      .map(r => r.call?.caller_name)
      .filter((r): r is string => !!r && r !== 'Unknown')
  )).sort();

  const scoreKey = `${selectedScore}_score` as keyof ExternalCallIntel;
  const justificationKey = `${selectedScore}_justification` as keyof ExternalCallIntel;

  // Filter records
  const filteredRecords = data.intelRecords.filter(record => {
    const score = record[scoreKey] as number | null;
    const justification = record[justificationKey] as string | null;
    
    // Must have score
    if (score === null) return false;
    
    // Score range filter
    if (score < scoreRange[0] || score > scoreRange[1]) return false;
    
    // Rep filter
    if (selectedRep !== 'all') {
      const rep = record.call?.caller_name || 'Unknown';
      if (rep !== selectedRep) return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const justText = justification?.toLowerCase() || '';
      const contactName = record.call?.to_name?.toLowerCase() || '';
      const callerName = record.call?.caller_name?.toLowerCase() || '';
      
      if (!justText.includes(query) && !contactName.includes(query) && !callerName.includes(query)) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    const scoreA = (a[scoreKey] as number | null) ?? 0;
    const scoreB = (b[scoreKey] as number | null) ?? 0;
    return scoreB - scoreA;
  });

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-muted text-muted-foreground';
    if (score >= 8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (score >= 4) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Score Justification Browser
          </CardTitle>
          <CardDescription>
            Understand WHY calls received certain scores. Essential for coaching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-wrap gap-4">
            <Select value={selectedScore} onValueChange={setSelectedScore}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select score type" />
              </SelectTrigger>
              <SelectContent>
                {SCORE_FIELDS.map((field) => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRep} onValueChange={setSelectedRep}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {reps.map((rep) => (
                  <SelectItem key={rep} value={rep}>
                    {rep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Score: {scoreRange[0]}-{scoreRange[1]}</span>
              <Slider
                value={scoreRange}
                onValueChange={(v) => setScoreRange(v as [number, number])}
                min={1}
                max={10}
                step={1}
                className="w-32"
              />
            </div>

            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search justifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredRecords.length} calls with {SCORE_FIELDS.find(f => f.key === selectedScore)?.label} scores
          </div>

          {/* Justification Cards - Expanded by default per spec */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {filteredRecords.slice(0, 50).map((record) => {
                const score = record[scoreKey] as number | null;
                const justification = record[justificationKey] as string | null;
                const callTitle = record.call?.to_name || record.call?.to_phone || 'Unknown Contact';
                const rep = record.call?.caller_name || 'Unknown';
                const duration = record.call?.talk_duration;
                const callDate = record.call?.started_at
                  ? format(parseISO(record.call.started_at), 'MMM d, yyyy')
                  : '-';

                // Get other scores for context
                const otherScores = [
                  { label: 'SI', value: record.seller_interest_score },
                  { label: 'SA', value: record.script_adherence_score },
                  { label: 'OH', value: record.objection_handling_score },
                ].filter(s => s.value !== null);

                return (
                  <div key={record.id} className="border rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-muted/30">
                      <div className="flex items-center gap-4">
                        <Badge className={cn('min-w-[3.5rem] justify-center text-lg font-bold', getScoreColor(score))}>
                          {score !== null ? formatScore(score, config) : '-'}
                        </Badge>
                        <div>
                          <div className="font-medium text-lg">{callTitle}</div>
                          <div className="text-sm text-muted-foreground">
                            {rep} • {callDate} {duration ? `• ${formatDuration(duration)}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.call?.recording_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(record.call?.recording_url!, '_blank')}
                          >
                            <Headphones className="h-4 w-4 mr-1" />
                            Listen
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          More
                        </Button>
                      </div>
                    </div>

                    {/* Justification - Always visible per spec */}
                    <div className="p-4 border-t">
                      <div className="flex items-start gap-2 mb-2">
                        <Quote className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                        <span className="text-sm font-medium text-muted-foreground">JUSTIFICATION</span>
                      </div>
                      <p className="text-sm leading-relaxed pl-6">
                        {justification || 'No justification available for this score.'}
                      </p>
                    </div>

                    {/* Other Scores Footer */}
                    {otherScores.length > 0 && (
                      <div className="px-4 pb-3 text-sm text-muted-foreground">
                        Other scores: {otherScores.map((s, i) => (
                          <span key={s.label}>
                            {i > 0 && ' | '}{s.label}: {s.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No calls found with the selected criteria.
            </div>
          )}

          {filteredRecords.length > 50 && (
            <div className="text-center text-sm text-muted-foreground">
              Showing first 50 of {filteredRecords.length} calls
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
