import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCallLibrary, LIBRARY_CATEGORIES, CallLibraryEntry } from '@/hooks/useCallLibrary';
import { Library, Play, Clock, Star, Trash2, Plus, Search, Phone, User } from 'lucide-react';
import { format } from 'date-fns';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function LibraryEntryCard({ entry, onRemove }: { entry: CallLibraryEntry; onRemove: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground truncate">{entry.title}</h4>
            {entry.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
            )}
            
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {entry.call?.host_email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {entry.call.host_email}
                </div>
              )}
              {entry.ai_score?.composite_score && (
                <Badge variant={entry.ai_score.composite_score >= 70 ? 'default' : 'secondary'}>
                  Score: {entry.ai_score.composite_score}
                </Badge>
              )}
            </div>

            {entry.tags && entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entry.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {entry.call?.phoneburner_recording_url && (
              <Button size="sm" variant="outline" asChild>
                <a href={entry.call.phoneburner_recording_url} target="_blank" rel="noopener noreferrer">
                  <Play className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySection({ category, entries, onRemove }: {
  category: typeof LIBRARY_CATEGORIES[0];
  entries: CallLibraryEntry[];
  onRemove: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Library className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No calls in this category yet</p>
        <p className="text-sm mt-1">Add calls from the Call Search or Best/Worst Calls pages</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <LibraryEntryCard
          key={entry.id}
          entry={entry}
          onRemove={() => onRemove(entry.id)}
        />
      ))}
    </div>
  );
}

export default function CallLibrary() {
  const { entriesByCategory, entries, isLoading, removeFromLibrary } = useCallLibrary();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchQuery || 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = activeCategory === 'all' || entry.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleRemove = (id: string) => {
    removeFromLibrary.mutate(id);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Call Library</h1>
            <p className="text-muted-foreground">
              Curated collection of exemplary calls for training and reference
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              <Library className="h-4 w-4 mr-2" />
              {entries.length} Calls
            </Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by title, description, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={activeCategory} onValueChange={setActiveCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {LIBRARY_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        {activeCategory === 'all' && !searchQuery ? (
          <Tabs defaultValue={LIBRARY_CATEGORIES[0].value} className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-2">
              {LIBRARY_CATEGORIES.map(cat => {
                const count = entriesByCategory.find(e => e.value === cat.value)?.entries.length || 0;
                return (
                  <TabsTrigger key={cat.value} value={cat.value} className="flex items-center gap-2">
                    {cat.label}
                    {count > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {LIBRARY_CATEGORIES.map(cat => {
              const categoryEntries = entriesByCategory.find(e => e.value === cat.value)?.entries || [];
              return (
                <TabsContent key={cat.value} value={cat.value} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">{cat.description}</p>
                  </div>
                  <CategorySection 
                    category={cat} 
                    entries={categoryEntries}
                    onRemove={handleRemove}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'result' : 'results'}
              {searchQuery && ` for "${searchQuery}"`}
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEntries.map(entry => (
                <LibraryEntryCard
                  key={entry.id}
                  entry={entry}
                  onRemove={() => handleRemove(entry.id)}
                />
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            Loading library...
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
