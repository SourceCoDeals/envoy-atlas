import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Linkedin, Phone, MessageSquare } from 'lucide-react';

interface GeneratorInputsProps {
  channel: string;
  setChannel: (value: string) => void;
  sequenceStep: string;
  setSequenceStep: (value: string) => void;
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

const CHANNELS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'linkedin_connection', label: 'LinkedIn Connection', icon: Linkedin },
  { value: 'linkedin_inmail', label: 'LinkedIn InMail', icon: Linkedin },
  { value: 'linkedin_message', label: 'LinkedIn Message', icon: MessageSquare },
  { value: 'phone_cold_call', label: 'Cold Call Script', icon: Phone },
  { value: 'phone_voicemail', label: 'Voicemail Script', icon: Phone },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
];

const SEQUENCE_STEPS = {
  email: [
    { value: 'first_touch', label: 'First Touch' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'value_add', label: 'Value Add' },
    { value: 'breakup', label: 'Breakup' },
  ],
  linkedin_connection: [
    { value: 'connection_request', label: 'Connection Request' },
  ],
  linkedin_inmail: [
    { value: 'first_touch', label: 'First Touch' },
    { value: 'follow_up', label: 'Follow-up' },
  ],
  linkedin_message: [
    { value: 'post_accept', label: 'Post-Accept (First Message)' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'soft_pitch', label: 'Soft Pitch' },
  ],
  phone_cold_call: [
    { value: 'cold_call', label: 'Cold Call Script' },
  ],
  phone_voicemail: [
    { value: 'voicemail', label: 'Voicemail' },
  ],
  sms: [
    { value: 'first_touch', label: 'First Touch' },
    { value: 'follow_up', label: 'Follow-up' },
  ],
};


export function GeneratorInputs({
  channel,
  setChannel,
  sequenceStep,
  setSequenceStep,
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
  const steps = SEQUENCE_STEPS[channel as keyof typeof SEQUENCE_STEPS] || SEQUENCE_STEPS.email;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Generation Inputs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Channel Selection */}
        <div className="space-y-2">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={(val) => {
            setChannel(val);
            // Reset step when channel changes
            const newSteps = SEQUENCE_STEPS[val as keyof typeof SEQUENCE_STEPS];
            if (newSteps?.length) {
              setSequenceStep(newSteps[0].value);
            }
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map(ch => (
                <SelectItem key={ch.value} value={ch.value}>
                  <div className="flex items-center gap-2">
                    <ch.icon className="h-4 w-4" />
                    {ch.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sequence Step */}
        <div className="space-y-2">
          <Label>Sequence Step</Label>
          <Select value={sequenceStep} onValueChange={setSequenceStep}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {steps.map(step => (
                <SelectItem key={step.value} value={step.value}>
                  {step.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Buyer Name */}
        <div className="space-y-2">
          <Label>Buyer Company Name</Label>
          <Input
            placeholder="e.g., Acme Corp"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
          />
        </div>

        {/* Buyer Website */}
        <div className="space-y-2">
          <Label>Buyer Website</Label>
          <Input
            placeholder="e.g., acme.com"
            value={buyerWebsite}
            onChange={(e) => setBuyerWebsite(e.target.value)}
          />
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input
            placeholder="e.g., SaaS, FinTech, Healthcare..."
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </div>

        {/* Pain Points */}
        <div className="space-y-2">
          <Label>Pain Points</Label>
          <Textarea
            placeholder="e.g., Struggling with lead quality, high CAC, low conversion rates..."
            value={painPoints}
            onChange={(e) => setPainPoints(e.target.value)}
            className="resize-none h-20"
          />
        </div>

        {/* Email Goal */}
        <div className="space-y-2">
          <Label>Goal of the Email</Label>
          <Textarea
            placeholder="e.g., Book a discovery call, get a reply, introduce our solution..."
            value={emailGoal}
            onChange={(e) => setEmailGoal(e.target.value)}
            className="resize-none h-16"
          />
        </div>

        {/* Tone */}
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
