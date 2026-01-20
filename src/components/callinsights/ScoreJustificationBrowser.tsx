import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  MessageSquare, Search, ChevronDown, ChevronUp, 
  ExternalLink, Phone, Calendar 
} from 'lucide-react';
import { CallInsightsData, ExternalCallIntel } from '@/hooks/useExternalCallIntel';
import { CallingMetricsConfig, formatScore } from '@/lib/callingConfig';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { format, parseISO } from 'date-fns';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

const SCORE_FIELDS = [
  { key: 'seller_interest', label: 'Seller Interest' },
  { key: 'objection_handling', label: 'Objection Handling' },
  { key: 'valuation_discussion', label: 'Valuation Discussion' },
  { key: 'rapport_building', label: 'Rapport Building' },
  { key: 'value_proposition', label: 'Value Proposition' },
  { key: 'conversation_quality', label: 'Conversation Quality' },
  { key: 'script_adherence', label: 'Script Adherence' },
  { key: 'overall_quality', label: 'Overall Quality' },
  { key: 'question_adherence', label: 'Question Adherence' },
  { key: 'personal_insights', label: 'Personal Insights' },
  { key: 'next_steps_clarity', label: 'Next Steps Clarity' },
  { key: 'discovery', label: 'Discovery' },
];

export function ScoreJustificationBrowser({ data, config }: Props) {
  const [selectedScore, setSelectedScore] = useState<string>('overall_quality');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!data) return null;

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const scoreKey = `${selectedScore}_score` as keyof ExternalCallIntel;
  const justificationKey = `${selectedScore}_justification` as keyof ExternalCallIntel;

  // Filter records that have the selected score and justification
  const filteredRecords = data.intelRecords.filter(record => {
    const score = record[scoreKey];
    const justification = record[justificationKey];
    
    if (score === null && !justification) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const justText = (justification as string | null)?.toLowerCase() || '';
      const contactName = record.call?.to_name?.toLowerCase() || '';
      const callerName = record.call?.caller_name?.toLowerCase() || '';
      
      return justText.includes(query) || contactName.includes(query) || callerName.includes(query);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Score Justification Browser
          </CardTitle>
          <CardDescription>
            Explore AI-generated explanations for each score to understand WHY scores are what they are
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <Select value={selectedScore} onValueChange={setSelectedScore}>
              <SelectTrigger className="w-[250px]">
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
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search justifications, contacts, or reps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredRecords.length} records with {SCORE_FIELDS.find(f => f.key === selectedScore)?.label} scores
          </div>

          {/* Justification List */}
          <div className="space-y-2">
            {filteredRecords.slice(0, 50).map((record) => {
              const score = record[scoreKey] as number | null;
              const justification = record[justificationKey] as string | null;
              const isExpanded = expandedIds.has(record.id);
              
              return (
                <Collapsible 
                  key={record.id} 
                  open={isExpanded}
                  onOpenChange={() => toggleExpand(record.id)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <Badge className={cn('min-w-[3rem] justify-center', getScoreColor(score))}>
                            {score !== null ? formatScore(score, config) : '-'}
                          </Badge>
                          <div className="text-left">
                            <div className="font-medium">
                              {record.call?.to_name || record.call?.to_phone || 'Unknown Contact'}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              {record.call?.caller_name || 'Unknown Rep'}
                              {record.call?.started_at && (
                                <>
                                  <span>•</span>
                                  <Calendar className="h-3 w-3" />
                                  {format(parseISO(record.call.started_at), 'MMM d, yyyy')}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {record.call?.recording_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(record.call?.recording_url!, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t bg-muted/30">
                        <div className="pt-4">
                          <h4 className="text-sm font-medium mb-2">AI Justification</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {justification || 'No justification available for this score.'}
                          </p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No records found with the selected score type or search criteria.
            </div>
          )}

          {filteredRecords.length > 50 && (
            <div className="text-center text-sm text-muted-foreground">
              Showing first 50 of {filteredRecords.length} records
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
