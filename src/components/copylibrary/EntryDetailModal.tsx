import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Star, Calendar, BarChart3, X, Save } from 'lucide-react';
import { CopyLibraryEntry } from '@/hooks/useCopyLibrary';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EntryDetailModalProps {
  entry: CopyLibraryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<CopyLibraryEntry>) => Promise<boolean>;
}

const CATEGORIES = [
  { value: 'intro', label: 'Intro' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'breakup', label: 'Breakup' },
  { value: 'meeting_request', label: 'Meeting Request' },
  { value: 'value_add', label: 'Value Add' },
  { value: 'case_study', label: 'Case Study' },
  { value: 're_engage', label: 'Re-engage' },
  { value: 'custom', label: 'Custom' },
];

export function EntryDetailModal({ entry, open, onOpenChange, onUpdate }: EntryDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(entry?.notes || '');
  const [editedCategory, setEditedCategory] = useState(entry?.category || 'custom');
  const [editedManualTags, setEditedManualTags] = useState<string[]>(entry?.manual_tags || []);
  const [newTag, setNewTag] = useState('');
  const [editedIsTemplate, setEditedIsTemplate] = useState(entry?.is_template || false);

  // Reset edit state when entry changes
  if (entry && (editedNotes !== entry.notes || editedCategory !== entry.category)) {
    if (!isEditing) {
      setEditedNotes(entry.notes || '');
      setEditedCategory(entry.category);
      setEditedManualTags(entry.manual_tags || []);
      setEditedIsTemplate(entry.is_template);
    }
  }

  if (!entry) return null;

  const copyToClipboard = () => {
    const text = entry.email_body 
      ? `Subject: ${entry.subject_line}\n\n${entry.email_body}`
      : entry.subject_line;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !editedManualTags.includes(tag)) {
      setEditedManualTags([...editedManualTags, tag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditedManualTags(editedManualTags.filter(t => t !== tag));
  };

  const handleSave = async () => {
    const success = await onUpdate(entry.id, {
      notes: editedNotes.trim() || null,
      category: editedCategory,
      manual_tags: editedManualTags,
      is_template: editedIsTemplate,
    });
    if (success) {
      setIsEditing(false);
    }
  };

  const performance = entry.performance_snapshot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex-1">Copy Details</DialogTitle>
            {entry.is_template && (
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Copy Content */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Subject Line</Label>
              <div className="rounded-lg border bg-muted/50 p-3 mt-1">
                <p className="font-medium">{entry.subject_line}</p>
              </div>
            </div>

            {entry.email_body && (
              <div>
                <Label className="text-xs text-muted-foreground">Email Body</Label>
                <div className="rounded-lg border bg-muted/50 p-3 mt-1 max-h-48 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{entry.email_body}</p>
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              Copy to Clipboard
            </Button>
          </div>

          <Separator />

          {/* Performance Snapshot */}
          {performance && Object.keys(performance).length > 0 && (
            <>
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4" />
                  Performance at Save Time
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {performance.sent_count !== undefined && (
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-semibold">{performance.sent_count.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Sent</p>
                    </div>
                  )}
                  {performance.reply_rate !== undefined && (
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-semibold">{(performance.reply_rate * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Reply Rate</p>
                    </div>
                  )}
                  {performance.positive_rate !== undefined && (
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-semibold">{(performance.positive_rate * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Positive Rate</p>
                    </div>
                  )}
                  {performance.open_rate !== undefined && (
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-semibold">{(performance.open_rate * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Open Rate</p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Tags */}
          <div className="space-y-3">
            <Label>Tags</Label>
            
            {entry.ai_tags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">AI-Generated</p>
                <div className="flex flex-wrap gap-1">
                  {entry.ai_tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1">Custom Tags</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {(isEditing ? editedManualTags : entry.manual_tags).map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                    {isEditing && (
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {!isEditing && entry.manual_tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No custom tags</span>
                )}
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="h-8"
                  />
                  <Button variant="outline" size="sm" onClick={handleAddTag} disabled={!newTag.trim()}>
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Category & Template */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              {isEditing ? (
                <Select value={editedCategory} onValueChange={setEditedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editedIsTemplate}
                    onCheckedChange={setEditedIsTemplate}
                  />
                  <span className="text-sm">{editedIsTemplate ? 'Yes' : 'No'}</span>
                </div>
              ) : (
                <p className="text-sm">{entry.is_template ? 'Yes' : 'No'}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            {isEditing ? (
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="When to use this copy, what worked well..."
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {entry.notes || 'No notes added'}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Saved {format(new Date(entry.created_at), 'MMM d, yyyy')}
            </span>
            {performance?.saved_at && (
              <span>
                Performance from {format(new Date(performance.saved_at), 'MMM d, yyyy')}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit Details
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
