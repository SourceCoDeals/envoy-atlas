import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Trophy, 
  Copy, 
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { stripHtml, getConfidenceLevel, getMarginOfError, analyzeWhyItWorks, detectEmailStep, STEP_LABELS } from '@/lib/textUtils';

interface TemplateCardProps {
  template: {
    id: string;
    variant_name: string;
    campaign_name: string;
    subject_line: string;
    body_preview: string | null;
    word_count: number;
    personalization_vars: string[];
    reply_rate: number;
    positive_rate: number;
    sent_count: number;
  };
  rank: number;
  onViewDetails?: (template: any) => void;
}

export function TemplateCard({ template, rank, onViewDetails }: TemplateCardProps) {
  const confidence = getConfidenceLevel(template.sent_count);
  const marginOfError = getMarginOfError(template.reply_rate, template.sent_count);
  const cleanBody = stripHtml(template.body_preview);
  const step = detectEmailStep(template.variant_name || template.campaign_name);
  const whyItWorks = analyzeWhyItWorks(
    template.subject_line,
    cleanBody,
    template.word_count,
    template.personalization_vars
  );
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyFullEmail = () => {
    const fullText = `Subject: ${template.subject_line}\n\n${cleanBody}`;
    navigator.clipboard.writeText(fullText);
    toast.success('Full email copied to clipboard');
  };
  
  const getConfidenceBadge = () => {
    const config = {
      low: { 
        label: 'Low Confidence', 
        className: 'bg-warning/20 text-warning border-warning/30',
        icon: AlertTriangle,
        tooltip: 'Less than 200 sends - results may be unreliable'
      },
      medium: { 
        label: 'Medium', 
        className: 'bg-primary/20 text-primary border-primary/30',
        icon: null,
        tooltip: '200-499 sends - directionally reliable'
      },
      high: { 
        label: 'High Confidence', 
        className: 'bg-success/20 text-success border-success/30',
        icon: CheckCircle2,
        tooltip: '500+ sends - statistically reliable'
      },
    };
    
    const { label, className, icon: Icon, tooltip } = config[confidence];
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`text-xs ${className}`}>
              {Icon && <Icon className="h-3 w-3 mr-1" />}
              {label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {template.sent_count.toLocaleString()} sends
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card className={rank <= 3 ? 'border-success/30' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {rank <= 3 && (
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success/20">
                <Trophy className="h-3 w-3 text-success" />
              </div>
            )}
            <Badge variant="outline" className="text-xs">
              #{rank}
            </Badge>
            <Badge 
              className={`text-xs ${
                template.reply_rate >= 10 
                  ? 'bg-success/20 text-success border-success/30' 
                  : 'bg-primary/20 text-primary border-primary/30'
              }`}
            >
              {template.reply_rate.toFixed(1)}% reply
              {marginOfError > 0 && (
                <span className="opacity-70 ml-1">±{marginOfError.toFixed(1)}%</span>
              )}
            </Badge>
            {getConfidenceBadge()}
          </div>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(template.subject_line, 'Subject line')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy subject line</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {onViewDetails && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(template)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View details</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Subject Line</p>
            <p className="font-medium">{template.subject_line}</p>
          </div>
          
          {cleanBody && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Preview</p>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {cleanBody}
              </p>
            </div>
          )}

          {/* Why It Works Section */}
          {whyItWorks.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <Lightbulb className="h-3 w-3" />
                Why It Works
              </div>
              <div className="flex flex-wrap gap-1.5">
                {whyItWorks.map((insight, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">
                    {insight}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              {template.word_count} words
            </Badge>
            {template.personalization_vars.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {template.personalization_vars.length} personalization
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {template.sent_count.toLocaleString()} sent
            </Badge>
            <Badge variant="outline" className="text-xs">
              {STEP_LABELS[step] || step}
            </Badge>
          </div>

          <div className="pt-2 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground truncate max-w-[60%]">
              {template.campaign_name}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={copyFullEmail}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy Full
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
