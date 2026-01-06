import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Archive, Trash2, Star, MoreVertical, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CopyLibraryEntry } from '@/hooks/useCopyLibrary';
import { toast } from 'sonner';

interface LibraryCardProps {
  entry: CopyLibraryEntry;
  onView: (entry: CopyLibraryEntry) => void;
  onUpdate: (id: string, updates: Partial<CopyLibraryEntry>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const categoryColors: Record<string, string> = {
  intro: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  follow_up: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  breakup: 'bg-red-500/10 text-red-500 border-red-500/20',
  meeting_request: 'bg-green-500/10 text-green-500 border-green-500/20',
  value_add: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  case_study: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  re_engage: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  custom: 'bg-muted text-muted-foreground border-muted',
};

const categoryLabels: Record<string, string> = {
  intro: 'Intro',
  follow_up: 'Follow-up',
  breakup: 'Breakup',
  meeting_request: 'Meeting Request',
  value_add: 'Value Add',
  case_study: 'Case Study',
  re_engage: 'Re-engage',
  custom: 'Custom',
};

export function LibraryCard({ entry, onView, onUpdate, onDelete }: LibraryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const copyToClipboard = () => {
    const text = entry.email_body 
      ? `Subject: ${entry.subject_line}\n\n${entry.email_body}`
      : entry.subject_line;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleArchive = async () => {
    await onUpdate(entry.id, { status: entry.status === 'archived' ? 'active' : 'archived' });
  };

  const handleToggleTemplate = async () => {
    await onUpdate(entry.id, { is_template: !entry.is_template });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(entry.id);
    setIsDeleting(false);
  };

  const replyRate = entry.performance_snapshot?.reply_rate;
  const allTags = [...entry.ai_tags, ...entry.manual_tags].slice(0, 4);

  return (
    <Card className={`group transition-all hover:shadow-md ${entry.status === 'archived' ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={categoryColors[entry.category] || categoryColors.custom}>
                {categoryLabels[entry.category] || entry.category}
              </Badge>
              {entry.is_template && (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              )}
              {replyRate !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  {(replyRate * 100).toFixed(1)}% reply
                </Badge>
              )}
            </div>
            <h3 className="font-medium text-sm line-clamp-2 cursor-pointer hover:text-primary" onClick={() => onView(entry)}>
              {entry.subject_line}
            </h3>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(entry)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleTemplate}>
                <Star className="h-4 w-4 mr-2" />
                {entry.is_template ? 'Remove from Templates' : 'Mark as Template'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                {entry.status === 'archived' ? 'Restore' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {entry.body_preview && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {entry.body_preview}
          </p>
        )}
        
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {(entry.ai_tags.length + entry.manual_tags.length) > 4 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                +{entry.ai_tags.length + entry.manual_tags.length - 4}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
