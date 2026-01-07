import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  XCircle, 
  Lightbulb, 
  Layout,
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react';
import { BestPractice } from '@/hooks/useCopywritingStudio';
import { cn } from '@/lib/utils';

interface BestPracticesPanelProps {
  channel: string;
  bestPractices: BestPractice[];
  isLoading: boolean;
  onRefresh: (channel: string) => void;
}

export function BestPracticesPanel({ 
  channel, 
  bestPractices, 
  isLoading, 
  onRefresh 
}: BestPracticesPanelProps) {
  useEffect(() => {
    onRefresh(channel);
  }, [channel, onRefresh]);

  const constraints = bestPractices.filter(p => p.practice_type === 'constraint');
  const patterns = bestPractices.filter(p => p.practice_type === 'pattern');
  const antiPatterns = bestPractices.filter(p => p.practice_type === 'anti_pattern');
  const structures = bestPractices.filter(p => p.practice_type === 'structure');

  const formatConfig = (config: Record<string, unknown>) => {
    if (config.ideal_min !== undefined && config.ideal_max !== undefined) {
      return `${config.ideal_min}-${config.ideal_max} ${config.unit || ''}`;
    }
    if (config.hard_limit !== undefined) {
      return `Max: ${config.hard_limit} ${config.unit || ''}`;
    }
    if (config.example) {
      return config.example as string;
    }
    if (config.words) {
      return (config.words as string[]).slice(0, 5).join(', ') + '...';
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          Best Practices
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {bestPractices.length} practices loaded for {channel.replace('_', ' ')}
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="constraints" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-auto">
            <TabsTrigger value="constraints" className="text-xs py-1.5">
              Constraints
            </TabsTrigger>
            <TabsTrigger value="patterns" className="text-xs py-1.5">
              Patterns
            </TabsTrigger>
            <TabsTrigger value="avoid" className="text-xs py-1.5">
              Avoid
            </TabsTrigger>
            <TabsTrigger value="structure" className="text-xs py-1.5">
              Structure
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px] mt-3">
            <TabsContent value="constraints" className="mt-0 space-y-2">
              {constraints.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No constraints defined</p>
              ) : (
                constraints.map(c => (
                  <div key={c.id} className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm capitalize">
                        {c.name.replace(/_/g, ' ')}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {c.category}
                      </Badge>
                    </div>
                    {formatConfig(c.config) && (
                      <p className="text-xs text-muted-foreground">
                        {formatConfig(c.config)}
                      </p>
                    )}
                    {c.description && (
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="patterns" className="mt-0 space-y-2">
              {patterns.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No patterns defined</p>
              ) : (
                patterns.map(p => (
                  <div key={p.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="font-medium text-sm capitalize">
                          {p.name.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {p.performance_lift && (
                        <Badge className={cn(
                          "text-xs border-0",
                          p.performance_lift > 0 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-red-500/20 text-red-400"
                        )}>
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +{p.performance_lift}%
                        </Badge>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    )}
                    {p.config.example && (
                      <p className="text-xs italic bg-muted/50 rounded p-2">
                        "{p.config.example as string}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="avoid" className="mt-0 space-y-2">
              {antiPatterns.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No anti-patterns defined</p>
              ) : (
                antiPatterns.map(a => (
                  <div key={a.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        <span className="font-medium text-sm capitalize">
                          {a.name.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {a.performance_lift && (
                        <Badge className="text-xs border-0 bg-red-500/20 text-red-400">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          {a.performance_lift}%
                        </Badge>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    )}
                    {a.config.example && (
                      <p className="text-xs italic bg-red-500/10 rounded p-2 text-red-300">
                        ✗ "{a.config.example as string}"
                      </p>
                    )}
                    {a.config.words && (
                      <div className="flex flex-wrap gap-1">
                        {(a.config.words as string[]).map((word, i) => (
                          <Badge key={i} variant="outline" className="text-xs text-red-400 border-red-400/30">
                            {word}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="structure" className="mt-0 space-y-2">
              {structures.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No structures defined</p>
              ) : (
                structures.map(s => (
                  <div key={s.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Layout className="h-4 w-4 text-blue-400" />
                      <span className="font-medium text-sm capitalize">
                        {s.name.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {s.config.lines && (
                      <ol className="text-xs space-y-1 pl-4">
                        {(s.config.lines as string[]).map((line, i) => (
                          <li key={i} className="text-muted-foreground">
                            <span className="text-primary mr-1">{i + 1}.</span> {line}
                          </li>
                        ))}
                      </ol>
                    )}
                    {s.config.word_range && (
                      <p className="text-xs text-muted-foreground">
                        Target: {(s.config.word_range as number[])[0]}-{(s.config.word_range as number[])[1]} words
                      </p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
