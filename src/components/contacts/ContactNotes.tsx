import { useState } from 'react';
import { ContactNote } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, Trash2, StickyNote, Tag, Bot, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ContactNotesProps {
  notes: ContactNote[];
  tags: string[];
  onAddNote: (text: string, type?: 'manual' | 'system' | 'ai_generated') => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

const NOTE_TYPE_ICONS = {
  manual: StickyNote,
  system: Settings,
  ai_generated: Bot,
};

export function ContactNotes({ notes, tags, onAddNote, onDeleteNote }: ContactNotesProps) {
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onAddNote(newNote.trim());
      setNewNote('');
      toast.success('Note added');
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await onDeleteNote(id);
      toast.success('Note deleted');
    } catch (err) {
      toast.error('Failed to delete note');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tags Section */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </h4>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <button className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="h-7 w-24 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTag.trim()) {
                  // TODO: Add tag
                  setNewTag('');
                }
              }}
            />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Add Note */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Add Note
        </h4>
        <div className="space-y-2">
          <Textarea
            placeholder="Write a note about this contact..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <Button 
            onClick={handleAddNote} 
            disabled={!newNote.trim() || isSubmitting}
            size="sm"
          >
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
      </div>

      {/* Notes List */}
      <div>
        <h4 className="text-sm font-medium mb-3">History</h4>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const Icon = NOTE_TYPE_ICONS[note.note_type];
              return (
                <Card key={note.id}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                      {note.note_type === 'manual' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
