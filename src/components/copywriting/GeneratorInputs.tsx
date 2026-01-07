import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Linkedin, Phone, MessageSquare, FileText } from 'lucide-react';

interface GeneratorInputsProps {
  channel: string;
  setChannel: (value: string) => void;
  sequenceStep: string;
  setSequenceStep: (value: string) => void;
  targetIndustry: string;
  setTargetIndustry: (value: string) => void;
  targetPersona: string;
  setTargetPersona: (value: string) => void;
  companyContext: string;
  setCompanyContext: (value: string) => void;
  triggerEvent: string;
  setTriggerEvent: (value: string) => void;
  tone: string;
  setTone: (value: string) => void;
  specificInstructions: string;
  setSpecificInstructions: (value: string) => void;
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

const INDUSTRIES = [
  'SaaS', 'FinTech', 'HealthTech', 'E-commerce', 'Manufacturing', 
  'Professional Services', 'Real Estate', 'Construction', 'Logistics',
  'EdTech', 'MarTech', 'HRTech', 'CyberSecurity', 'AI/ML', 'Other'
];

const PERSONAS = [
  'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CRO',
  'VP Sales', 'VP Marketing', 'VP Engineering', 'VP Operations', 'VP Finance',
  'Director Sales', 'Director Marketing', 'Director Engineering', 'Director HR',
  'Head of Growth', 'Head of Partnerships', 'Head of Product',
  'Sales Manager', 'Marketing Manager', 'Operations Manager',
  'Founder', 'Owner', 'Other'
];

export function GeneratorInputs({
  channel,
  setChannel,
  sequenceStep,
  setSequenceStep,
  targetIndustry,
  setTargetIndustry,
  targetPersona,
  setTargetPersona,
  companyContext,
  setCompanyContext,
  triggerEvent,
  setTriggerEvent,
  tone,
  setTone,
  specificInstructions,
  setSpecificInstructions,
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

        {/* Target Industry */}
        <div className="space-y-2">
          <Label>Target Industry</Label>
          <Select value={targetIndustry} onValueChange={setTargetIndustry}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry..." />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map(ind => (
                <SelectItem key={ind} value={ind.toLowerCase()}>
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target Persona */}
        <div className="space-y-2">
          <Label>Target Persona</Label>
          <Select value={targetPersona} onValueChange={setTargetPersona}>
            <SelectTrigger>
              <SelectValue placeholder="Select persona..." />
            </SelectTrigger>
            <SelectContent>
              {PERSONAS.map(persona => (
                <SelectItem key={persona} value={persona.toLowerCase()}>
                  {persona}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Company Context */}
        <div className="space-y-2">
          <Label>Company Context</Label>
          <Textarea
            placeholder="e.g., Series B SaaS company scaling sales team, 50-100 employees..."
            value={companyContext}
            onChange={(e) => setCompanyContext(e.target.value)}
            className="resize-none h-20"
          />
        </div>

        {/* Trigger Event */}
        <div className="space-y-2">
          <Label>Trigger Event (optional)</Label>
          <Textarea
            placeholder="e.g., Just raised Series B, New VP of Sales hire, Product launch..."
            value={triggerEvent}
            onChange={(e) => setTriggerEvent(e.target.value)}
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

        {/* Specific Instructions */}
        <div className="space-y-2">
          <Label>Specific Instructions (optional)</Label>
          <Textarea
            placeholder="Any specific requirements, value props to include, angles to try..."
            value={specificInstructions}
            onChange={(e) => setSpecificInstructions(e.target.value)}
            className="resize-none h-20"
          />
        </div>
      </CardContent>
    </Card>
  );
}
