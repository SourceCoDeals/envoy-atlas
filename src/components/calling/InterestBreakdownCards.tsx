import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Flame } from 'lucide-react';

interface InterestBreakdownCardsProps {
  breakdown: {
    yes: number;
    maybe: number;
    no: number;
    unknown: number;
  };
  totalCalls: number;
  positiveValues: string[];
}

export function InterestBreakdownCards({ breakdown, totalCalls, positiveValues }: InterestBreakdownCardsProps) {
  const cards = [
    {
      label: 'YES',
      sublabel: '(Hot)',
      count: breakdown.yes,
      percentage: totalCalls > 0 ? (breakdown.yes / totalCalls) * 100 : 0,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
    {
      label: 'MAYBE',
      sublabel: '(Warm)',
      count: breakdown.maybe,
      percentage: totalCalls > 0 ? (breakdown.maybe / totalCalls) * 100 : 0,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    },
    {
      label: 'NO',
      sublabel: '(Cold)',
      count: breakdown.no,
      percentage: totalCalls > 0 ? (breakdown.no / totalCalls) * 100 : 0,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
    },
    {
      label: 'UNKNOWN',
      sublabel: '',
      count: breakdown.unknown,
      percentage: totalCalls > 0 ? (breakdown.unknown / totalCalls) * 100 : 0,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      borderColor: 'border-muted',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Interest Breakdown
        </CardTitle>
        <CardDescription>From AI analysis of call content</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {cards.map((card) => (
            <div 
              key={card.label}
              className={`p-4 rounded-lg border ${card.bgColor} ${card.borderColor} text-center`}
            >
              <p className={`text-xs font-medium ${card.color}`}>
                {card.label} {card.sublabel}
              </p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.count}</p>
              <p className="text-xs text-muted-foreground">{card.percentage.toFixed(1)}%</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Positive values: {positiveValues.join(', ')}
        </p>
      </CardContent>
    </Card>
  );
}
