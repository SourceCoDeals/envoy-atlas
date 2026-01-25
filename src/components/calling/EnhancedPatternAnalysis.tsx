import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColdCall } from '@/hooks/useColdCallAnalytics';
import { Zap, AlertCircle, Quote, ArrowRight, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedPatternAnalysisProps {
  topCalls: ColdCall[];
  allCalls: ColdCall[];
  isLoading?: boolean;
}

interface PatternInsight {
  category: 'working' | 'objection' | 'phrase';
  title: string;
  insight: string;
  frequency: string;
  exampleCalls?: string[];
}

function analyzePatterns(topCalls: ColdCall[], allCalls: ColdCall[]): PatternInsight[] {
  const patterns: PatternInsight[] = [];

  // What's Working - analyze top calls
  if (topCalls.length > 0) {
    // Average duration insight
    const avgDuration = topCalls.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0) / topCalls.length;
    if (avgDuration > 300) { // 5+ minutes
      patterns.push({
        category: 'working',
        title: 'Extended Conversations',
        insight: `Top calls average ${Math.round(avgDuration / 60)} minutes - longer conversations correlate with higher scores`,
        frequency: `${topCalls.length} top calls`,
      });
    }

    // DM connection rate in top calls
    const dmRate = topCalls.filter(c => c.decision_maker_identified_score && c.decision_maker_identified_score >= 7).length / topCalls.length;
    if (dmRate > 0.5) {
      patterns.push({
        category: 'working',
        title: 'Decision Maker Access',
        insight: `${Math.round(dmRate * 100)}% of top calls reached decision makers - prioritize DM qualification`,
        frequency: `${Math.round(dmRate * topCalls.length)} of ${topCalls.length}`,
      });
    }

    // Interest conversion
    const interestRate = topCalls.filter(c => (c.seller_interest_score || 0) >= 7).length / topCalls.length;
    if (interestRate > 0.3) {
      patterns.push({
        category: 'working',
        title: 'Interest Generation',
        insight: `${Math.round(interestRate * 100)}% of top calls generated genuine interest - focus on value proposition`,
        frequency: `${Math.round(interestRate * topCalls.length)} high-interest calls`,
      });
    }
  }

  // Common Objections - parse from objections field
  const objectionCounts = new Map<string, number>();
  allCalls.forEach(call => {
    if (call.objections) {
      try {
        const objections = typeof call.objections === 'string' 
          ? JSON.parse(call.objections) 
          : call.objections;
        
        if (Array.isArray(objections)) {
          objections.forEach(obj => {
            const normalized = String(obj).toLowerCase().trim();
            objectionCounts.set(normalized, (objectionCounts.get(normalized) || 0) + 1);
          });
        }
      } catch {
        // Skip if parsing fails
      }
    }
  });

  // Top objections
  const topObjections = [...objectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  topObjections.forEach(([objection, count]) => {
    patterns.push({
      category: 'objection',
      title: objection.charAt(0).toUpperCase() + objection.slice(0),
      insight: `Encountered ${count} times - prepare counter-arguments`,
      frequency: `${count} calls`,
    });
  });

  // If no objection data, add placeholder
  if (topObjections.length === 0 && allCalls.length > 0) {
    patterns.push({
      category: 'objection',
      title: 'Objection tracking',
      insight: 'Enable AI objection detection to surface common pushback themes',
      frequency: 'Not tracked',
    });
  }

  // Winning Phrases - would require NLP analysis of transcripts
  // For now, add a placeholder suggesting future enhancement
  patterns.push({
    category: 'phrase',
    title: 'Analyze Transcripts',
    insight: 'Extract winning phrases from top-performing call transcripts',
    frequency: `${topCalls.filter(c => c.call_transcript).length} transcripts available`,
  });

  return patterns;
}

export function EnhancedPatternAnalysis({ topCalls, allCalls, isLoading }: EnhancedPatternAnalysisProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-yellow-500" />
            Pattern Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const patterns = analyzePatterns(topCalls, allCalls);

  const workingPatterns = patterns.filter(p => p.category === 'working');
  const objectionPatterns = patterns.filter(p => p.category === 'objection');
  const phrasePatterns = patterns.filter(p => p.category === 'phrase');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'working':
        return <Lightbulb className="h-4 w-4 text-emerald-500" />;
      case 'objection':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'phrase':
        return <Quote className="h-4 w-4 text-blue-500" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'working':
        return 'border-emerald-500/20 bg-emerald-500/5';
      case 'objection':
        return 'border-amber-500/20 bg-amber-500/5';
      case 'phrase':
        return 'border-blue-500/20 bg-blue-500/5';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-yellow-500" />
          Pattern Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* What's Working */}
        {workingPatterns.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-emerald-600 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              What's Working
            </h4>
            {workingPatterns.map((pattern, idx) => (
              <div
                key={idx}
                className={cn('p-3 rounded-lg border', getCategoryColor(pattern.category))}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{pattern.title}</p>
                  <Badge variant="outline" className="text-xs">
                    {pattern.frequency}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{pattern.insight}</p>
              </div>
            ))}
          </div>
        )}

        {/* Common Objections */}
        {objectionPatterns.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-amber-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Common Objections
            </h4>
            {objectionPatterns.map((pattern, idx) => (
              <div
                key={idx}
                className={cn('p-3 rounded-lg border', getCategoryColor(pattern.category))}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{pattern.title}</p>
                  <Badge variant="outline" className="text-xs">
                    {pattern.frequency}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{pattern.insight}</p>
              </div>
            ))}
          </div>
        )}

        {/* Winning Phrases */}
        {phrasePatterns.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <Quote className="h-4 w-4" />
              Transcript Insights
            </h4>
            {phrasePatterns.map((pattern, idx) => (
              <div
                key={idx}
                className={cn('p-3 rounded-lg border', getCategoryColor(pattern.category))}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{pattern.title}</p>
                  <Badge variant="outline" className="text-xs">
                    {pattern.frequency}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{pattern.insight}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
