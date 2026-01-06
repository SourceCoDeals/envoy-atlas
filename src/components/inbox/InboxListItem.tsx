import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Timer, Calendar, MessageSquare, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CLASSIFICATION_CONFIG, type ReplyClassification, type PriorityLevel } from '@/lib/replyClassification';

interface InboxItem {
  id: string;
  lead_email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  campaign_name: string;
  reply_content: string | null;
  classification: ReplyClassification;
  priority: PriorityLevel;
  occurred_at: string;
  hoursAgo: number;
  minutesAgo: number;
  isOverdue: boolean;
  targetResponseHours: number;
  timeRemaining: string;
  threadLength: number;
  isICP: boolean;
}

interface InboxListItemProps {
  item: InboxItem;
  isSelected: boolean;
  onSelect: () => void;
}

export function InboxListItem({ item, isSelected, onSelect }: InboxListItemProps) {
  const config = CLASSIFICATION_CONFIG[item.classification];
  
  const getPriorityIndicator = () => {
    if (item.isOverdue) {
      return <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />;
    }
    switch (item.priority) {
      case 'P0':
        return <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
      case 'P1':
        return <div className="w-2 h-2 rounded-full bg-orange-500" />;
      case 'P2':
        return <div className="w-2 h-2 rounded-full bg-yellow-500" />;
      case 'P3':
        return <div className="w-2 h-2 rounded-full bg-blue-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />;
    }
  };

  const getTimeDisplay = () => {
    if (item.minutesAgo < 60) return `${item.minutesAgo}m ago`;
    if (item.hoursAgo < 24) return `${item.hoursAgo}h ago`;
    return formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true });
  };

  const getQuickActions = () => {
    switch (item.classification) {
      case 'meeting_request':
        return ['Send Calendar', 'Propose Times'];
      case 'interested':
        return ['Send Calendar', 'Send Case Study'];
      case 'question':
        return ['Answer + Book', 'Send FAQ'];
      case 'referral':
        return ['Thank + Add Referral'];
      default:
        return ['Reply'];
    }
  };

  return (
    <div
      className={`p-4 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
        isSelected ? 'bg-accent' : ''
      } ${item.isOverdue ? 'border-l-2 border-l-destructive' : ''}`}
      onClick={onSelect}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getPriorityIndicator()}
          <Badge className={`${config.bgClass} ${config.textClass} ${config.borderClass} text-xs shrink-0`}>
            {item.isOverdue && <Timer className="mr-1 h-3 w-3" />}
            {item.priority} — {config.label.toUpperCase()}
          </Badge>
        </div>
        <span className={`text-xs whitespace-nowrap ${item.isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {item.isOverdue ? (
            <>🔴 {item.timeRemaining}</>
          ) : (
            <>⏰ {item.timeRemaining}</>
          )}
        </span>
      </div>

      {/* Contact Info */}
      <div className="mb-2">
        <p className="font-medium text-sm">
          {item.first_name} {item.last_name || ''}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.title && `${item.title} @ `}{item.company || item.lead_email.split('@')[1]}
          {item.company && (
            <span className="text-muted-foreground/60"> • {item.lead_email.split('@')[1]}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Campaign: {item.campaign_name}
        </p>
      </div>

      {/* Reply Preview */}
      <div className="bg-muted/50 rounded-md p-2 mb-2">
        <p className="text-xs text-muted-foreground line-clamp-2 italic">
          "{item.reply_content?.substring(0, 150) || 'No content'}{item.reply_content && item.reply_content.length > 150 ? '...' : ''}"
        </p>
      </div>

      {/* Meta Row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>📧 {getTimeDisplay()}</span>
          {item.threadLength > 1 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {item.threadLength} messages
            </span>
          )}
          {item.isICP && (
            <Badge variant="outline" className="text-success border-success/30 text-[10px] py-0">
              ICP Match ✓
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mt-3">
        {getQuickActions().slice(0, 2).map(action => (
          <Button 
            key={action} 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              // Handle action
            }}
          >
            {action === 'Send Calendar' && <Calendar className="h-3 w-3 mr-1" />}
            {action}
          </Button>
        ))}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-xs ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            // Handle view thread
          }}
        >
          View Thread <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
