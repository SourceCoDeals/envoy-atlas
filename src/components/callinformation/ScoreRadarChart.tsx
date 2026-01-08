import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ScoreRadarChartProps {
  scores: {
    sellerInterest: number;
    objectionHandling: number;
    rapportBuilding: number;
    valueProposition: number;
    engagement: number;
    scriptAdherence: number;
    nextStepClarity: number;
    valuationDiscussion: number;
    overallQuality: number;
    decisionMakerIdentification: number;
  };
}

export function ScoreRadarChart({ scores }: ScoreRadarChartProps) {
  const data = [
    { dimension: 'Seller Interest', score: scores.sellerInterest, fullMark: 10 },
    { dimension: 'Objection Handling', score: scores.objectionHandling, fullMark: 10 },
    { dimension: 'Rapport Building', score: scores.rapportBuilding, fullMark: 10 },
    { dimension: 'Value Proposition', score: scores.valueProposition, fullMark: 10 },
    { dimension: 'Engagement', score: scores.engagement, fullMark: 10 },
    { dimension: 'Script Adherence', score: scores.scriptAdherence, fullMark: 10 },
    { dimension: 'Next Step Clarity', score: scores.nextStepClarity, fullMark: 10 },
    { dimension: 'Valuation Discussion', score: scores.valuationDiscussion, fullMark: 10 },
    { dimension: 'Overall Quality', score: scores.overallQuality, fullMark: 10 },
    { dimension: 'Decision Maker ID', score: scores.decisionMakerIdentification, fullMark: 10 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Average Score Dimensions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
              <PolarGrid stroke="hsl(var(--muted-foreground))" opacity={0.3} />
              <PolarAngleAxis 
                dataKey="dimension" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 10]} 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
