import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CallInsightsData } from '@/hooks/useExternalCallIntel';

interface Props {
  data: CallInsightsData;
}

const OBJECTION_PATTERNS = [
  { name: 'Timing', patterns: ['not ready', 'too early', 'not now', 'few years', 'not the right time'] },
  { name: 'Valuation', patterns: ['valuation', 'numbers', 'price', 'multiple', "doesn't make sense", 'too low'] },
  { name: 'Structure', patterns: ["don't want pe", 'minority', 'control', 'roll up', 'private equity'] },
  { name: 'Confidentiality', patterns: ['nda', 'confidential', 'share information', 'sensitive'] },
  { name: 'Size', patterns: ['too small', 'not big enough', 'small business'] },
  { name: 'Busy', patterns: ['busy', 'on my way', 'no time', 'call back', 'not a good time'] },
  { name: 'Family/Succession', patterns: ['kids', 'family', 'succession', 'children', 'next generation'] },
  { name: 'Culture', patterns: ['employees', 'culture', 'team', 'legacy', 'staff'] },
];

export function ObjectionCategoriesChart({ data }: Props) {
  // Parse objections from all records
  const objectionCategories = OBJECTION_PATTERNS.map(pattern => {
    let count = 0;
    let resolved = 0;

    data.intelRecords.forEach(record => {
      const objections = record.objections_list || [];
      const objectionText = objections.join(' ').toLowerCase();
      
      pattern.patterns.forEach(p => {
        if (objectionText.includes(p.toLowerCase())) {
          count++;
          // Estimate resolution based on resolution rate
          if (record.number_of_objections && record.objections_resolved_count) {
            const rate = record.objections_resolved_count / record.number_of_objections;
            resolved += rate;
          }
        }
      });
    });

    const resolutionRate = count > 0 ? (resolved / count) * 100 : 0;
    return { name: pattern.name, count, resolutionRate };
  }).filter(c => c.count > 0).sort((a, b) => b.count - a.count);

  if (objectionCategories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Common Objection Categories</CardTitle>
          <CardDescription>Parsed from AI-extracted objection lists</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No objection categories identified yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...objectionCategories.map(c => c.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Common Objection Categories</CardTitle>
        <CardDescription>Parsed from AI-extracted objection lists</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {objectionCategories.map(category => (
            <div key={category.name} className="flex items-center gap-4">
              <div className="w-32 font-medium text-sm">{category.name}</div>
              <div className="flex-1">
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      category.resolutionRate >= 80 && "bg-green-500",
                      category.resolutionRate >= 50 && category.resolutionRate < 80 && "bg-yellow-500",
                      category.resolutionRate < 50 && "bg-red-500",
                    )}
                    style={{ width: `${(category.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
              <div className="w-24 text-sm text-right text-muted-foreground">
                {category.count} ({category.resolutionRate.toFixed(0)}%)
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
