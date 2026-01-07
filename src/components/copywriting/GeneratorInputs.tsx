import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GeneratorInputsProps {
  buyerName: string;
  setBuyerName: (value: string) => void;
  buyerWebsite: string;
  setBuyerWebsite: (value: string) => void;
  industry: string;
  setIndustry: (value: string) => void;
  painPoints: string;
  setPainPoints: (value: string) => void;
  emailGoal: string;
  setEmailGoal: (value: string) => void;
  tone: string;
  setTone: (value: string) => void;
}

export function GeneratorInputs({
  buyerName,
  setBuyerName,
  buyerWebsite,
  setBuyerWebsite,
  industry,
  setIndustry,
  painPoints,
  setPainPoints,
  emailGoal,
  setEmailGoal,
  tone,
  setTone,
}: GeneratorInputsProps) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Buyer Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Buyer Company Name</Label>
          <Input placeholder="e.g., Acme Corp" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Buyer Website</Label>
          <Input placeholder="e.g., acme.com" value={buyerWebsite} onChange={(e) => setBuyerWebsite(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input placeholder="e.g., SaaS, FinTech, Healthcare..." value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Pain Points</Label>
          <Textarea placeholder="e.g., Struggling with lead quality, high CAC..." value={painPoints} onChange={(e) => setPainPoints(e.target.value)} className="resize-none h-20" />
        </div>
        <div className="space-y-2">
          <Label>Goal of the Outreach</Label>
          <Textarea placeholder="e.g., Book a discovery call, get a reply..." value={emailGoal} onChange={(e) => setEmailGoal(e.target.value)} className="resize-none h-16" />
        </div>
        <div className="space-y-3">
          <Label>Tone</Label>
          <RadioGroup value={tone} onValueChange={setTone} className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="conversational" id="conversational" />
              <Label htmlFor="conversational" className="font-normal cursor-pointer">Conversational</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="formal" id="formal" />
              <Label htmlFor="formal" className="font-normal cursor-pointer">Formal</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="bold" id="bold" />
              <Label htmlFor="bold" className="font-normal cursor-pointer">Bold</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="friendly" id="friendly" />
              <Label htmlFor="friendly" className="font-normal cursor-pointer">Friendly</Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
