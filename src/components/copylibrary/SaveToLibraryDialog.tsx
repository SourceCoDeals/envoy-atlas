import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, X } from 'lucide-react';
import { useCopyLibrary, SaveToLibraryOptions } from '@/hooks/useCopyLibrary';

interface SaveToLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantData: {
    title?: string;
    subject_line: string;
    body_html?: string | null;
    body_plain?: string | null;
    variant_id?: string | null;
    performance?: {
      sent_count?: number;
      reply_rate?: number;
      positive_rate?: number;
      open_rate?: number;
    };
  } | null;
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

export function SaveToLibraryDialog({ open, onOpenChange, variantData }: SaveToLibraryDialogProps) {
  const { saveToLibrary, generateTags, saving, generatingTags } = useCopyLibrary();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('custom');
  const [notes, setNotes] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (open && variantData) {
      setTitle(variantData.title || variantData.subject_line.substring(0, 50));
      setCategory('custom');
      setNotes('');
      setIsTemplate(false);
      setTags([]);
      setNewTag('');
      setAiTags([]);
      setQualityScore(null);
    }
  }, [open, variantData]);

  const handleGenerateTags = async () => {
    if (!variantData) return;
    
    const result = await generateTags(
      variantData.subject_line,
      variantData.body_html || variantData.body_plain,
      category
    );
    
    if (result) {
      setAiTags(result.ai_tags);
      setQualityScore(result.quality_score);
      if (category === 'custom') {
        setCategory(result.suggested_category);
      }
    }
  };

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!variantData) return;

    const allTags = [...tags, ...aiTags];

    const options: SaveToLibraryOptions = {
      category,
      notes: notes.trim() || undefined,
      is_template: isTemplate,
      tags: allTags,
      generateTags: aiTags.length === 0 // Only generate if not already done
    };

    const result = await saveToLibrary({
      title: title || variantData.subject_line.substring(0, 50),
      subject_line: variantData.subject_line,
      body_html: variantData.body_html,
      body_plain: variantData.body_plain,
      variant_id: variantData.variant_id,
      performance: variantData.performance,
    }, options);
    
    if (result) {
      onOpenChange(false);
    }
  };

  if (!variantData) return null;

  const bodyPreview = variantData.body_html || variantData.body_plain;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save to Copy Library</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this copy a name..."
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="font-medium text-sm mb-1">{variantData.subject_line}</p>
            {bodyPreview && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {bodyPreview.substring(0, 200)}
              </p>
            )}
            {variantData.performance?.reply_rate !== undefined && (
              <Badge variant="secondary" className="mt-2 text-xs">
                {(variantData.performance.reply_rate * 100).toFixed(1)}% reply rate
              </Badge>
            )}
          </div>

          {/* AI Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>AI-Generated Tags</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateTags}
                disabled={generatingTags}
              >
                {generatingTags ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {aiTags.length > 0 ? 'Regenerate' : 'Generate Tags'}
              </Button>
            </div>
            {aiTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {aiTags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {qualityScore !== null && (
              <p className="text-xs text-muted-foreground">
                Quality Score: {qualityScore}/100
              </p>
            )}
          </div>

          {/* Manual Tags */}
          <div className="space-y-2">
            <Label>Custom Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button variant="outline" onClick={handleAddTag} disabled={!newTag.trim()}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs pr-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
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
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="When to use this copy, what worked well..."
              rows={2}
            />
          </div>

          {/* Template Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="template-toggle">Mark as Template</Label>
            <Switch
              id="template-toggle"
              checked={isTemplate}
              onCheckedChange={setIsTemplate}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save to Library
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
