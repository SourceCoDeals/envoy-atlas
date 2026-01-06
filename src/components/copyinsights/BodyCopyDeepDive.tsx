import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlignLeft, 
  TrendingUp, 
  TrendingDown, 
  List, 
  Link2, 
  MessageCircle,
  BookOpen,
  FileText,
} from 'lucide-react';

interface StructuralMetric {
  metric_name: string;
  bucket: string;
  reply_rate: number;
  sample_size: number;
  lift_vs_baseline: number;
}

interface BodyCopyDeepDiveProps {
  // Structural elements
  paragraphData: StructuralMetric[];
  bulletData: StructuralMetric[];
  linkData: {
    has_link: boolean;
    reply_rate: number;
    sample_size: number;
  }[];
  linkTypeData?: {
    link_type: string;
    reply_rate: number;
    sample_size: number;
  }[];
  
  // Linguistic elements
  readingGradeData: StructuralMetric[];
  sentenceLengthData: StructuralMetric[];
  youIRatioData: StructuralMetric[];
  questionCountData: StructuralMetric[];
  
  // Summary stats
  avgWordCount: number;
  avgParagraphs: number;
  avgBullets: number;
  avgReadingGrade: number;
  
  baselineReplyRate: number;
}

const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

export function BodyCopyDeepDive({
  paragraphData,
  bulletData,
  linkData,
  linkTypeData,
  readingGradeData,
  sentenceLengthData,
  youIRatioData,
  questionCountData,
  avgWordCount,
  avgParagraphs,
  avgBullets,
  avgReadingGrade,
  baselineReplyRate,
}: BodyCopyDeepDiveProps) {
  const linkImpact = useMemo(() => {
    const withLink = linkData.find(d => d.has_link);
    const withoutLink = linkData.find(d => !d.has_link);
    if (withLink && withoutLink && withoutLink.reply_rate > 0) {
      return {
        lift: ((withLink.reply_rate - withoutLink.reply_rate) / withoutLink.reply_rate) * 100,
        withRate: withLink.reply_rate,
        withoutRate: withoutLink.reply_rate,
      };
    }
    return null;
  }, [linkData]);

  const bestBulletBucket = useMemo(() => {
    if (bulletData.length === 0) return null;
    return [...bulletData].sort((a, b) => b.reply_rate - a.reply_rate)[0];
  }, [bulletData]);

  const bestParagraphBucket = useMemo(() => {
    if (paragraphData.length === 0) return null;
    return [...paragraphData].sort((a, b) => b.reply_rate - a.reply_rate)[0];
  }, [paragraphData]);

  const bestReadingGrade = useMemo(() => {
    if (readingGradeData.length === 0) return null;
    return [...readingGradeData].sort((a, b) => b.reply_rate - a.reply_rate)[0];
  }, [readingGradeData]);

  return (
    <div className="space-y-4">
      {/* Quick Stats Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlignLeft className="h-5 w-5 text-chart-4" />
            <CardTitle className="text-lg">Body Copy Deep Dive</CardTitle>
          </div>
          <CardDescription>
            Structural and linguistic analysis of email bodies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {/* Average Word Count */}
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-xl font-bold">{Math.round(avgWordCount)}</div>
              <div className="text-xs text-muted-foreground">Avg Words</div>
            </div>
            
            {/* Average Paragraphs */}
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <AlignLeft className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-xl font-bold">{avgParagraphs.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Avg Paragraphs</div>
            </div>
            
            {/* Average Bullets */}
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <List className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-xl font-bold">{avgBullets.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Avg Bullets</div>
            </div>
            
            {/* Reading Grade */}
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <BookOpen className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-xl font-bold">{avgReadingGrade.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Reading Grade</div>
            </div>
            
            {/* Link Impact */}
            {linkImpact && (
              <div className={`p-3 rounded-lg border text-center ${linkImpact.lift < 0 ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30'}`}>
                <Link2 className={`h-4 w-4 mx-auto mb-1 ${linkImpact.lift < 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div className={`text-xl font-bold ${linkImpact.lift < 0 ? 'text-destructive' : ''}`}>
                  {linkImpact.lift > 0 ? '+' : ''}{linkImpact.lift.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Links Impact</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Structural Elements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Structural Elements</CardTitle>
            <CardDescription className="text-xs">
              Paragraphs, bullets, and formatting impact
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Paragraph Count */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Paragraph Count</span>
                {bestParagraphBucket && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                    Best: {bestParagraphBucket.bucket}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {paragraphData.slice(0, 4).map((item) => {
                  const maxRate = Math.max(...paragraphData.map(d => d.reply_rate));
                  const width = maxRate > 0 ? (item.reply_rate / maxRate) * 100 : 0;
                  const isBest = item === bestParagraphBucket;
                  
                  return (
                    <div key={item.bucket} className={`p-1.5 rounded ${isBest ? 'bg-success/10' : ''}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>{item.bucket}</span>
                        <span className="font-mono">{formatRate(item.reply_rate)}</span>
                      </div>
                      <Progress value={width} className="h-1" />
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Bullet Points */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Bullet Point Usage</span>
                {bestBulletBucket && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                    Best: {bestBulletBucket.bucket}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {bulletData.slice(0, 4).map((item) => {
                  const maxRate = Math.max(...bulletData.map(d => d.reply_rate));
                  const width = maxRate > 0 ? (item.reply_rate / maxRate) * 100 : 0;
                  const isBest = item === bestBulletBucket;
                  
                  return (
                    <div key={item.bucket} className={`p-1.5 rounded ${isBest ? 'bg-success/10' : ''}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>{item.bucket}</span>
                        <span className="font-mono">{formatRate(item.reply_rate)}</span>
                      </div>
                      <Progress value={width} className="h-1" />
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Link Warning */}
            {linkImpact && linkImpact.lift < -10 && (
              <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">Links Hurt Performance</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Emails with links see {formatRate(linkImpact.withRate)} reply rate vs {formatRate(linkImpact.withoutRate)} without.
                  Consider removing links from initial emails.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linguistic Elements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Linguistic Elements</CardTitle>
            <CardDescription className="text-xs">
              Readability, sentence structure, and language
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reading Grade */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Reading Grade Level</span>
                {bestReadingGrade && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                    Best: {bestReadingGrade.bucket}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {readingGradeData.slice(0, 4).map((item) => {
                  const maxRate = Math.max(...readingGradeData.map(d => d.reply_rate));
                  const width = maxRate > 0 ? (item.reply_rate / maxRate) * 100 : 0;
                  const isBest = item === bestReadingGrade;
                  
                  return (
                    <div key={item.bucket} className={`p-1.5 rounded ${isBest ? 'bg-success/10' : ''}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>{item.bucket}</span>
                        <span className="font-mono">{formatRate(item.reply_rate)}</span>
                      </div>
                      <Progress value={width} className="h-1" />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Grade 6-8 reading level typically performs best — simpler = clearer
              </p>
            </div>
            
            {/* Question Count */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Questions in Body</span>
              </div>
              <div className="space-y-1">
                {questionCountData.slice(0, 3).map((item) => {
                  const maxRate = Math.max(...questionCountData.map(d => d.reply_rate));
                  const width = maxRate > 0 ? (item.reply_rate / maxRate) * 100 : 0;
                  const isPositive = item.lift_vs_baseline > 0;
                  
                  return (
                    <div key={item.bucket} className="p-1.5">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-2">
                          <MessageCircle className="h-3 w-3 text-muted-foreground" />
                          {item.bucket}
                        </span>
                        <span className="font-mono flex items-center gap-1">
                          {formatRate(item.reply_rate)}
                          {item.lift_vs_baseline !== 0 && (
                            <span className={`text-[10px] ${isPositive ? 'text-success' : 'text-destructive'}`}>
                              ({isPositive ? '+' : ''}{item.lift_vs_baseline.toFixed(0)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress value={width} className="h-1" />
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* You:I Ratio */}
            {youIRatioData.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">You:I Ratio</span>
                </div>
                <Table>
                  <TableBody>
                    {youIRatioData.slice(0, 3).map((item) => {
                      const isPositive = item.lift_vs_baseline > 0;
                      return (
                        <TableRow key={item.bucket}>
                          <TableCell className="text-xs py-1.5">{item.bucket}</TableCell>
                          <TableCell className="text-right font-mono text-xs py-1.5">
                            {formatRate(item.reply_rate)}
                          </TableCell>
                          <TableCell className="text-right py-1.5">
                            <span className={`text-xs ${isPositive ? 'text-success' : 'text-destructive'}`}>
                              {isPositive ? '+' : ''}{item.lift_vs_baseline.toFixed(0)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
