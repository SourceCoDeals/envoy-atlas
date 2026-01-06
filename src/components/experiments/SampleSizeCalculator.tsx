import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calculator, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SampleSizeCalculatorProps {
  dailySendCapacity?: number;
  baselineReplyRate?: number;
}

// Sample size calculation for two-proportion z-test
// n = 2 * (Zα/2 + Zβ)² * p(1-p) / (p1 - p2)²
// For 95% confidence (Zα/2 = 1.96) and 80% power (Zβ = 0.84)
function calculateSampleSize(baselineRate: number, relativeLift: number): number {
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + relativeLift);
  const pPooled = (p1 + p2) / 2;
  
  // Z values for 95% confidence, 80% power
  const zAlpha = 1.96;
  const zBeta = 0.84;
  
  const effectSize = Math.abs(p2 - p1);
  if (effectSize === 0) return Infinity;
  
  const numerator = 2 * Math.pow(zAlpha + zBeta, 2) * pPooled * (1 - pPooled);
  const denominator = Math.pow(effectSize, 2);
  
  return Math.ceil(numerator / denominator);
}

export function SampleSizeCalculator({ 
  dailySendCapacity = 500,
  baselineReplyRate = 0.03 
}: SampleSizeCalculatorProps) {
  const [liftSize, setLiftSize] = useState<'small' | 'medium' | 'large' | 'very_large'>('large');
  const [customBaseline, setCustomBaseline] = useState(baselineReplyRate * 100);
  
  const liftOptions = {
    small: { label: 'Small', relativeLift: 0.10, description: '10% relative lift' },
    medium: { label: 'Medium', relativeLift: 0.25, description: '25% relative lift' },
    large: { label: 'Large', relativeLift: 0.50, description: '50% relative lift' },
    very_large: { label: 'Very Large', relativeLift: 1.00, description: '100% relative lift' }
  };
  
  const selectedLift = liftOptions[liftSize];
  const baseline = customBaseline / 100;
  const absoluteLift = baseline * selectedLift.relativeLift;
  
  const samplePerVariant = calculateSampleSize(baseline, selectedLift.relativeLift);
  const totalSampleNeeded = samplePerVariant * 2;
  const daysToComplete = Math.ceil(totalSampleNeeded / dailySendCapacity);
  
  const isFeasible = samplePerVariant < 50000 && daysToComplete < 180;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Sample Size Calculator
        </CardTitle>
        <CardDescription>
          Understand how many sends you need for reliable results
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Baseline Rate Slider */}
        <div className="space-y-3">
          <Label>Your baseline reply rate: {customBaseline.toFixed(1)}%</Label>
          <Slider
            value={[customBaseline]}
            onValueChange={([value]) => setCustomBaseline(value)}
            min={0.5}
            max={10}
            step={0.1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Industry average for cold email is 1-3%
          </p>
        </div>

        {/* Lift Size Selection */}
        <div className="space-y-3">
          <Label>What size improvement do you want to detect?</Label>
          <RadioGroup 
            value={liftSize} 
            onValueChange={(v) => setLiftSize(v as typeof liftSize)}
            className="grid gap-2"
          >
            {Object.entries(liftOptions).map(([key, option]) => {
              const sample = calculateSampleSize(baseline, option.relativeLift);
              const days = Math.ceil((sample * 2) / dailySendCapacity);
              const absoluteChange = (baseline * option.relativeLift * 100).toFixed(2);
              
              return (
                <div key={key} className="flex items-center space-x-3">
                  <RadioGroupItem value={key} id={key} />
                  <Label 
                    htmlFor={key} 
                    className="flex-1 cursor-pointer p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{option.label}</span>
                        <span className="text-muted-foreground ml-2">
                          ({option.description} / +{absoluteChange}% absolute)
                        </span>
                      </div>
                      <div className="text-right text-sm">
                        <span className="font-mono">{sample.toLocaleString()}</span>
                        <span className="text-muted-foreground"> per variant</span>
                        <span className="text-muted-foreground ml-2">• ~{days} days</span>
                      </div>
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {/* Results Summary */}
        <div className={`p-4 rounded-lg border ${isFeasible ? 'bg-success/5 border-success/30' : 'bg-destructive/5 border-destructive/30'}`}>
          <div className="flex items-start gap-3">
            {isFeasible ? (
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">
                {isFeasible ? 'Feasible Test Configuration' : 'May Be Impractical'}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Sample per variant</p>
                  <p className="font-mono font-medium">{samplePerVariant.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total emails needed</p>
                  <p className="font-mono font-medium">{totalSampleNeeded.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estimated duration</p>
                  <p className="font-mono font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {daysToComplete} days
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Detectable lift</p>
                  <p className="font-mono font-medium">
                    ≥{(selectedLift.relativeLift * 100).toFixed(0)}% relative / +{(absoluteLift * 100).toFixed(2)}% absolute
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Explanation */}
        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Understanding Sample Size</p>
          <p>
            Sample size determines what size effect you can reliably detect. Smaller effects require 
            more data. At your current baseline of {customBaseline.toFixed(1)}%, you need:
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>~{calculateSampleSize(baseline, 0.5).toLocaleString()} sends/variant to detect 50%+ relative lifts</li>
            <li>~{calculateSampleSize(baseline, 0.25).toLocaleString()} sends/variant to detect 25%+ relative lifts</li>
            <li>~{calculateSampleSize(baseline, 0.1).toLocaleString()} sends/variant to detect 10%+ relative lifts</li>
          </ul>
          <p className="mt-2 text-xs">
            ⚠️ If no winner is found, the true difference is likely smaller than your target lift.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
