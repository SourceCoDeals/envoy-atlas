import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import type { BodyCopyAnalysis } from '@/hooks/useCopyAnalytics';
import { calculateYouIRatio } from '@/lib/patternTaxonomy';
import { ExecutiveSummary } from '../ExecutiveSummary';

interface BodyCopyTabProps {
  bodyCopy: BodyCopyAnalysis[];
  baselineReplyRate: number;
}

export function BodyCopyTab({ bodyCopy, baselineReplyRate }: BodyCopyTabProps) {
  // Word count analysis
  const wordCountBuckets = useMemo(() => {
    const buckets = [
      { range: '<50', min: 0, max: 50, sent: 0, replies: 0 },
      { range: '50-100', min: 50, max: 100, sent: 0, replies: 0 },
      { range: '100-150', min: 100, max: 150, sent: 0, replies: 0 },
      { range: '150-200', min: 150, max: 200, sent: 0, replies: 0 },
      { range: '200+', min: 200, max: Infinity, sent: 0, replies: 0 },
    ];

    bodyCopy.forEach(b => {
      const bucket = buckets.find(bkt => b.word_count >= bkt.min && b.word_count < bkt.max);
      if (bucket) {
        bucket.sent += b.sent_count;
        bucket.replies += b.reply_count;
      }
    });

    return buckets.map(b => ({
      ...b,
      reply_rate: b.sent > 0 ? (b.replies / b.sent) * 100 : 0,
    }));
  }, [bodyCopy]);

  const avgWordCount = bodyCopy.length > 0 
    ? Math.round(bodyCopy.reduce((sum, b) => sum + b.word_count, 0) / bodyCopy.length)
    : 0;

  // You:We ratio analysis
  const youWeRatioBuckets = useMemo(() => {
    const buckets = [
      { range: '<1:1', min: 0, max: 1, sent: 0, replies: 0, label: 'Self-focused' },
      { range: '1-2:1', min: 1, max: 2, sent: 0, replies: 0, label: 'Balanced' },
      { range: '2-3:1', min: 2, max: 3, sent: 0, replies: 0, label: 'Prospect-focused' },
      { range: '3+:1', min: 3, max: Infinity, sent: 0, replies: 0, label: 'Highly focused' },
    ];

    bodyCopy.forEach(b => {
      const ratio = calculateYouIRatio(b.email_body || b.body_preview || '');
      const bucket = buckets.find(bkt => ratio >= bkt.min && ratio < bkt.max);
      if (bucket) {
        bucket.sent += b.sent_count;
        bucket.replies += b.reply_count;
      }
    });

    return buckets.map(b => ({
      ...b,
      reply_rate: b.sent > 0 ? (b.replies / b.sent) * 100 : 0,
    }));
  }, [bodyCopy]);

  // CTA performance
  const ctaPerformance = useMemo(() => {
    const groups: Record<string, { sent: number; replies: number }> = {};
    
    bodyCopy.forEach(b => {
      const cta = b.cta_type || 'unknown';
      if (!groups[cta]) groups[cta] = { sent: 0, replies: 0 };
      groups[cta].sent += b.sent_count;
      groups[cta].replies += b.reply_count;
    });

    return Object.entries(groups)
      .map(([cta, data]) => ({
        type: cta,
        rate: data.sent > 0 ? (data.replies / data.sent) * 100 : 0,
        sample: data.sent,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [bodyCopy]);

  // Generate executive summary insights
  const bestLengthBucket = wordCountBuckets.reduce((best, b) => b.reply_rate > best.reply_rate ? b : best, wordCountBuckets[0]);
  const bestRatioBucket = youWeRatioBuckets.reduce((best, b) => b.reply_rate > best.reply_rate ? b : best, youWeRatioBuckets[0]);
  const topCTA = ctaPerformance[0];

  const executiveInsights = [
    {
      type: avgWordCount > 100 ? 'warning' as const : 'positive' as const,
      title: avgWordCount > 100 ? 'Your emails are too long' : 'Your email length is good',
      description: avgWordCount > 100
        ? `At ${avgWordCount} words on average, you're losing readers. Emails under 100 words get ${(wordCountBuckets[1]?.reply_rate - wordCountBuckets[3]?.reply_rate).toFixed(1)}% higher reply rates.`
        : `At ${avgWordCount} words, your emails are digestible. Short emails respect busy inboxes.`,
      impact: avgWordCount > 100 ? 'Cut words' : 'Good length',
    },
    {
      type: bestRatioBucket.range.includes('3+') || bestRatioBucket.range.includes('2-3') ? 'positive' as const : 'warning' as const,
      title: `Focus on "you" not "we"`,
      description: bestRatioBucket.range.includes('<1')
        ? `Your emails talk too much about yourself. Flip the script—talk about the recipient's problems and goals.`
        : `Emails with a ${bestRatioBucket.range} you:we ratio perform best (${bestRatioBucket.reply_rate.toFixed(1)}% replies). Make it about them.`,
      impact: `${bestRatioBucket.reply_rate.toFixed(1)}% reply rate`,
    },
    {
      type: topCTA ? 'positive' as const : 'neutral' as const,
      title: topCTA ? `"${topCTA.type}" CTAs work best` : 'Test different CTAs',
      description: topCTA
        ? `When you use ${topCTA.type.toLowerCase()} calls-to-action, you get ${topCTA.rate.toFixed(1)}% reply rates. Low-friction asks outperform hard calendar pushes.`
        : 'You need more data to identify your best CTA style.',
      impact: topCTA ? `${topCTA.rate.toFixed(1)}% replies` : undefined,
    },
  ];

  const bottomLine = avgWordCount > 100
    ? `Trim your emails to under 100 words, focus on "you" language, and use soft CTAs like "Does this make sense?" instead of calendar links.`
    : `Keep your emails short. Focus on the reader. Ask low-friction questions.`;

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <ExecutiveSummary
        title="Body Copy: What Makes People Reply"
        subtitle="How your email structure and language affects response rates"
        insights={executiveInsights}
        bottomLine={bottomLine}
      />

      {/* Word Count Impact */}
      <Card>
        <CardHeader>
          <CardTitle>Email Length Impact</CardTitle>
          <CardDescription>Shorter emails consistently outperform longer ones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wordCountBuckets}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 10]} />
                <RechartsTooltip />
                <Bar dataKey="reply_rate" radius={[4, 4, 0, 0]}>
                  {wordCountBuckets.map((entry, index) => (
                    <Cell 
                      key={index} 
                      fill={index < 2 ? 'hsl(var(--success))' : 
                            index < 3 ? 'hsl(var(--muted-foreground))' :
                            'hsl(var(--destructive))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
            <strong>📊 INSIGHT:</strong> Emails under 100 words have {wordCountBuckets[1]?.reply_rate.toFixed(1)}% reply rate 
            vs {wordCountBuckets[3]?.reply_rate.toFixed(1)}% for 150+ words. 
            Your average: <strong>{avgWordCount} words</strong> {avgWordCount > 100 ? '⚠️ Too Long' : '✓ Good'}
          </div>
        </CardContent>
      </Card>

      {/* You:We Ratio */}
      <Card>
        <CardHeader>
          <CardTitle>Prospect Focus: You vs We Ratio</CardTitle>
          <CardDescription>Emails that focus on "you" outperform self-focused "we" emails</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {youWeRatioBuckets.map((bucket, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 text-sm">{bucket.range}</div>
                <div className="w-28 text-xs text-muted-foreground">{bucket.label}</div>
                <div className="flex-1 relative h-6 bg-muted rounded">
                  <div 
                    className={`absolute h-full rounded ${
                      i >= 2 ? 'bg-success' : i === 1 ? 'bg-yellow-500' : 'bg-destructive'
                    }`}
                    style={{ width: `${Math.min((bucket.reply_rate / 8) * 100, 100)}%` }}
                  />
                </div>
                <div className="w-14 text-sm font-medium">{bucket.reply_rate.toFixed(1)}%</div>
                <Badge variant="outline" className="text-xs">n={bucket.sent.toLocaleString()}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA Performance */}
      <Card>
        <CardHeader>
          <CardTitle>CTA Type Performance</CardTitle>
          <CardDescription>Lower friction CTAs get more responses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ctaPerformance.slice(0, 6).map((cta, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-32 truncate">{cta.type}</div>
                <div className="flex-1 relative h-4 bg-muted rounded">
                  <div 
                    className={`absolute h-full rounded ${
                      i < 2 ? 'bg-success' : i < 4 ? 'bg-yellow-500' : 'bg-destructive'
                    }`}
                    style={{ width: `${Math.min((cta.rate / 8) * 100, 100)}%` }}
                  />
                </div>
                <div className="w-12 font-medium">{cta.rate.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
