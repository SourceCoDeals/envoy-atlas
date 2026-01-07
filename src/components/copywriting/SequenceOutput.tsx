import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Save, Check, Mail, Linkedin, Phone, MessageSquare, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { CopyVariation } from '@/hooks/useCopywritingStudio';

export interface SequenceStepOutput {
  stepIndex: number;
  channel: string;
  stepType: string;
  delayDays: number;
  variations: CopyVariation[];
}

interface SequenceOutputProps {
  sequenceOutput: SequenceStepOutput[];
  onSaveToLibrary: (variation: CopyVariation, category: string) => Promise<boolean>;
}

const getChannelIcon = (channel: string) => {
  if (channel.startsWith('linkedin')) return Linkedin;
  if (channel.startsWith('phone')) return Phone;
  if (channel === 'sms') return MessageSquare;
  return Mail;
};

const getChannelLabel = (channel: string) => {
  const labels: Record<string, string> = {
    email: 'Email',
    linkedin_connection: 'LinkedIn Connection',
    linkedin_inmail: 'LinkedIn InMail',
    linkedin_message: 'LinkedIn Message',
    phone_cold_call: 'Cold Call',
    phone_voicemail: 'Voicemail',
    sms: 'SMS',
  };
  return labels[channel] || channel;
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  return 'text-red-500';
};

const getScoreBg = (score: number) => {
  if (score >= 80) return 'bg-green-500/10 border-green-500/30';
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-red-500/10 border-red-500/30';
};

function VariationCard({ 
  variation, 
  stepIndex,
  channel,
  onSave 
}: { 
  variation: CopyVariation; 
  stepIndex: number;
  channel: string;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleCopy = async () => {
    const text = variation.subject_line 
      ? `Subject: ${variation.subject_line}\n\n${variation.body}`
      : variation.body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const hasIssues = variation.validation?.issues?.length > 0;
  const hasWarnings = variation.validation?.warnings?.length > 0;

  return (
    <div className={`border rounded-lg overflow-hidden bg-card/30 ${hasIssues ? 'border-red-500/50' : hasWarnings ? 'border-yellow-500/30' : 'border-border/50'}`}>
      <div 
        className="flex items-center justify-between p-3 bg-muted/20 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {variation.variation_style}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {variation.word_count} words
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`text-xs border ${getScoreBg(variation.quality_score)}`}>
                  <span className={getScoreColor(variation.quality_score)}>
                    {variation.quality_score}/100
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs font-medium mb-1">Quality Breakdown</p>
                <div className="text-xs space-y-0.5">
                  <div>Constraints: {(variation as any).quality_breakdown?.constraints || 0}/40</div>
                  <div>Patterns: {(variation as any).quality_breakdown?.patterns || 0}/30</div>
                  <div>Spam check: {(variation as any).quality_breakdown?.spam || 0}/15</div>
                  <div>Readability: {(variation as any).quality_breakdown?.readability || 0}/15</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {hasIssues && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <ul className="text-xs list-disc pl-3">
                    {variation.validation.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!hasIssues && hasWarnings && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <ul className="text-xs list-disc pl-3">
                    {variation.validation.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onSave(); }}
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4 space-y-3">
          {variation.subject_line && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Subject</p>
              <p className="font-medium text-sm">{variation.subject_line}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Body</p>
            <div className="text-sm whitespace-pre-wrap">{variation.body}</div>
          </div>
          {variation.patterns_used.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {variation.patterns_used.map((pattern, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {pattern}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SequenceOutput({ sequenceOutput, onSaveToLibrary }: SequenceOutputProps) {
  const [activeStep, setActiveStep] = useState('0');
  const [copiedAll, setCopiedAll] = useState(false);

  if (!sequenceOutput.length) {
    return null;
  }

  const handleCopyAll = async () => {
    const fullSequence = sequenceOutput.map((step, idx) => {
      const channelLabel = getChannelLabel(step.channel);
      const bestVariation = step.variations[0];
      const delay = idx === 0 ? 'Day 1' : `+${step.delayDays} days`;
      
      let text = `--- Step ${idx + 1}: ${channelLabel} (${delay}) ---\n`;
      if (bestVariation?.subject_line) {
        text += `Subject: ${bestVariation.subject_line}\n\n`;
      }
      text += bestVariation?.body || '';
      return text;
    }).join('\n\n');

    await navigator.clipboard.writeText(fullSequence);
    setCopiedAll(true);
    toast.success('Copied entire sequence to clipboard');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <Card className="bg-card/50 border-border/50 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Generated Sequence</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="text-xs"
            >
              {copiedAll ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                  Copy All
                </>
              )}
            </Button>
            <Badge variant="default" className="text-xs">
              {sequenceOutput.length} steps
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeStep} onValueChange={setActiveStep} className="w-full">
          <div className="px-4 pb-3 border-b border-border/50">
            <ScrollArea className="w-full">
              <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0 gap-2">
                {sequenceOutput.map((step, index) => {
                  const Icon = getChannelIcon(step.channel);
                  return (
                    <TabsTrigger
                      key={index}
                      value={String(index)}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 h-auto"
                    >
                      <Icon className="h-3.5 w-3.5 mr-1.5" />
                      <span className="text-xs">Step {index + 1}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </ScrollArea>
          </div>

          {sequenceOutput.map((step, index) => {
            const Icon = getChannelIcon(step.channel);
            return (
              <TabsContent key={index} value={String(index)} className="m-0">
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-medium">{getChannelLabel(step.channel)}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {step.stepType.replace('_', ' ')}
                    </Badge>
                    {index > 0 && (
                      <span className="text-muted-foreground text-xs">
                        +{step.delayDays} day{step.delayDays !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {step.variations.map((variation, vIndex) => (
                      <VariationCard
                        key={vIndex}
                        variation={variation}
                        stepIndex={index}
                        channel={step.channel}
                        onSave={async () => {
                          await onSaveToLibrary(variation, step.channel);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
