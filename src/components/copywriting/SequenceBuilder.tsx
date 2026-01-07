import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, GripVertical, Mail, Linkedin, Phone, MessageSquare } from 'lucide-react';

export interface SequenceStep {
  id: string;
  channel: string;
  stepType: string;
  delayDays: number;
}

interface SequenceBuilderProps {
  steps: SequenceStep[];
  setSteps: (steps: SequenceStep[]) => void;
}

const CHANNELS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'linkedin_connection', label: 'LinkedIn Connection', icon: Linkedin },
  { value: 'linkedin_inmail', label: 'LinkedIn InMail', icon: Linkedin },
  { value: 'linkedin_message', label: 'LinkedIn Message', icon: MessageSquare },
  { value: 'phone_cold_call', label: 'Cold Call', icon: Phone },
  { value: 'phone_voicemail', label: 'Voicemail', icon: Phone },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
];

const STEP_TYPES: Record<string, { value: string; label: string }[]> = {
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
    { value: 'post_accept', label: 'Post-Accept' },
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

const DELAY_OPTIONS = [
  { value: 0, label: 'Same day' },
  { value: 1, label: '1 day' },
  { value: 2, label: '2 days' },
  { value: 3, label: '3 days' },
  { value: 5, label: '5 days' },
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
];

export function SequenceBuilder({ steps, setSteps }: SequenceBuilderProps) {
  const addStep = () => {
    const newStep: SequenceStep = {
      id: crypto.randomUUID(),
      channel: 'email',
      stepType: 'follow_up',
      delayDays: steps.length === 0 ? 0 : 3,
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, updates: Partial<SequenceStep>) => {
    setSteps(steps.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ...updates };
      // Reset stepType when channel changes
      if (updates.channel && updates.channel !== s.channel) {
        const stepTypes = STEP_TYPES[updates.channel];
        updated.stepType = stepTypes?.[0]?.value || 'first_touch';
      }
      return updated;
    }));
  };

  const getChannelIcon = (channel: string) => {
    const ch = CHANNELS.find(c => c.value === channel);
    return ch ? ch.icon : Mail;
  };

  const getChannelLabel = (channel: string) => {
    return CHANNELS.find(c => c.value === channel)?.label || channel;
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Sequence Steps</CardTitle>
          <Badge variant="outline" className="text-xs">
            {steps.length} step{steps.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
            Add steps to build your sequence
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, index) => {
              const Icon = getChannelIcon(step.channel);
              const stepTypes = STEP_TYPES[step.channel] || STEP_TYPES.email;
              
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border/50"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                  
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    {/* Channel */}
                    <Select
                      value={step.channel}
                      onValueChange={(val) => updateStep(step.id, { channel: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3 w-3" />
                          <span className="truncate">{getChannelLabel(step.channel)}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNELS.map(ch => (
                          <SelectItem key={ch.value} value={ch.value}>
                            <div className="flex items-center gap-2">
                              <ch.icon className="h-3.5 w-3.5" />
                              {ch.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Step Type */}
                    <Select
                      value={step.stepType}
                      onValueChange={(val) => updateStep(step.id, { stepType: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stepTypes.map(st => (
                          <SelectItem key={st.value} value={st.value}>
                            {st.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Delay */}
                    <Select
                      value={String(step.delayDays)}
                      onValueChange={(val) => updateStep(step.id, { delayDays: parseInt(val) })}
                      disabled={index === 0}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELAY_OPTIONS.map(d => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {index === 0 ? 'Day 1' : `+${d.label}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => removeStep(step.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addStep}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </CardContent>
    </Card>
  );
}
