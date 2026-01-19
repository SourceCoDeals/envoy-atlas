import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useCopyLibrary, CopyLibraryEntry } from '@/hooks/useCopyLibrary';
import { LibraryCard } from '@/components/copylibrary/LibraryCard';
import { EntryDetailModal } from '@/components/copylibrary/EntryDetailModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Library, Star, Archive, Filter } from 'lucide-react';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'intro', label: 'Intro' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'breakup', label: 'Breakup' },
  { value: 'meeting_request', label: 'Meeting Request' },
  { value: 'value_add', label: 'Value Add' },
  { value: 'case_study', label: 'Case Study' },
  { value: 're_engage', label: 'Re-engage' },
  { value: 'custom', label: 'Custom' },
];

export default function CopyLibrary() {
  const { user, loading: authLoading } = useAuth();
  const { entries, loading, updateEntry, deleteEntry, searchEntries, allTags } = useCopyLibrary();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'templates' | 'archived'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<CopyLibraryEntry | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Filter entries based on current filters
  const filteredEntries = useMemo(() => {
    let isTemplate: boolean | undefined;

    if (activeTab === 'templates') {
      isTemplate = true;
    }

    return searchEntries(searchQuery, {
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      isTemplate,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    });
  }, [searchQuery, activeTab, selectedCategory, selectedTags, searchEntries]);

  const handleViewEntry = (entry: CopyLibraryEntry) => {
    setSelectedEntry(entry);
    setDetailModalOpen(true);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const counts = {
    all: entries.length,
    templates: entries.filter(e => e.is_template).length,
    archived: 0, // No status field in the new schema
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-6 w-6" />
            Copy Library
          </h1>
          <p className="text-muted-foreground">
            Your collection of proven email templates and snippets
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject, body, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              All
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {counts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Star className="h-4 w-4" />
              Templates
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {counts.templates}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Tag Filter Pills */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 15).map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
            {allTags.length > 15 && (
              <Badge variant="outline" className="text-xs">
                +{allTags.length - 15} more
              </Badge>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/30">
            <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">
              {entries.length === 0 ? 'Your library is empty' : 'No matching entries'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {entries.length === 0
                ? 'Save high-performing email variants from Copy Insights or Playbook to build your library.'
                : 'Try adjusting your search or filters to find what you\'re looking for.'}
            </p>
            {selectedTags.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setSelectedTags([])}
              >
                Clear tag filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEntries.map((entry) => (
              <LibraryCard
                key={entry.id}
                entry={entry}
                onView={handleViewEntry}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <EntryDetailModal
        entry={selectedEntry}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onUpdate={updateEntry}
      />
    </DashboardLayout>
  );
}