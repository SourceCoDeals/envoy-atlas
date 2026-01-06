import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CopyLibraryEntry {
  id: string;
  workspace_id: string;
  source_variant_id: string | null;
  subject_line: string;
  email_body: string | null;
  body_preview: string | null;
  personalization_vars: string[];
  performance_snapshot: {
    sent_count?: number;
    reply_rate?: number;
    positive_rate?: number;
    open_rate?: number;
    saved_at?: string;
  };
  ai_tags: string[];
  manual_tags: string[];
  notes: string | null;
  category: string;
  status: string;
  is_template: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SaveToLibraryOptions {
  category?: string;
  notes?: string;
  is_template?: boolean;
  manual_tags?: string[];
  generateTags?: boolean;
}

interface TagGenerationResult {
  ai_tags: string[];
  suggested_category: string;
  quality_score: number;
}

export function useCopyLibrary() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [entries, setEntries] = useState<CopyLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);

  // Fetch library entries
  useEffect(() => {
    if (!currentWorkspace?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const fetchEntries = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('copy_library')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const transformed = (data || []).map(entry => ({
          ...entry,
          personalization_vars: Array.isArray(entry.personalization_vars) 
            ? entry.personalization_vars as string[]
            : [],
          performance_snapshot: (entry.performance_snapshot || {}) as CopyLibraryEntry['performance_snapshot'],
          ai_tags: entry.ai_tags || [],
          manual_tags: entry.manual_tags || [],
        }));

        setEntries(transformed);
      } catch (error) {
        console.error('Error fetching library entries:', error);
        toast.error('Failed to load copy library');
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [currentWorkspace?.id]);

  // Generate AI tags for copy
  const generateTags = async (
    subjectLine: string,
    emailBody?: string | null,
    category?: string
  ): Promise<TagGenerationResult | null> => {
    setGeneratingTags(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-copy-tags', {
        body: {
          subject_line: subjectLine,
          email_body: emailBody,
          category
        }
      });

      if (error) throw error;
      return data as TagGenerationResult;
    } catch (error) {
      console.error('Error generating tags:', error);
      toast.error('Failed to generate AI tags');
      return null;
    } finally {
      setGeneratingTags(false);
    }
  };

  // Save a variant to the library
  const saveToLibrary = async (
    variantData: {
      subject_line: string;
      email_body?: string | null;
      body_preview?: string | null;
      personalization_vars?: string[];
      source_variant_id?: string | null;
      performance?: {
        sent_count?: number;
        reply_rate?: number;
        positive_rate?: number;
        open_rate?: number;
      };
    },
    options: SaveToLibraryOptions = {}
  ): Promise<CopyLibraryEntry | null> => {
    if (!currentWorkspace?.id || !user?.id) {
      toast.error('No workspace or user found');
      return null;
    }

    setSaving(true);
    try {
      let aiTags: string[] = [];
      let category = options.category || 'custom';

      // Generate AI tags if requested
      if (options.generateTags !== false) {
        const tagResult = await generateTags(
          variantData.subject_line,
          variantData.email_body,
          category
        );
        if (tagResult) {
          aiTags = tagResult.ai_tags;
          if (!options.category) {
            category = tagResult.suggested_category;
          }
        }
      }

      const insertData = {
        workspace_id: currentWorkspace.id,
        source_variant_id: variantData.source_variant_id || null,
        subject_line: variantData.subject_line,
        email_body: variantData.email_body || null,
        body_preview: variantData.body_preview || null,
        personalization_vars: variantData.personalization_vars || [],
        performance_snapshot: {
          ...variantData.performance,
          saved_at: new Date().toISOString()
        },
        ai_tags: aiTags,
        manual_tags: options.manual_tags || [],
        notes: options.notes || null,
        category,
        status: 'active',
        is_template: options.is_template || false,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('copy_library')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const newEntry: CopyLibraryEntry = {
        ...data,
        personalization_vars: Array.isArray(data.personalization_vars) 
          ? data.personalization_vars as string[]
          : [],
        performance_snapshot: data.performance_snapshot as CopyLibraryEntry['performance_snapshot'],
        ai_tags: data.ai_tags || [],
        manual_tags: data.manual_tags || [],
      };

      setEntries(prev => [newEntry, ...prev]);
      toast.success('Saved to Copy Library');
      return newEntry;
    } catch (error) {
      console.error('Error saving to library:', error);
      toast.error('Failed to save to library');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Update an entry
  const updateEntry = async (
    id: string,
    updates: Partial<Pick<CopyLibraryEntry, 'notes' | 'manual_tags' | 'category' | 'status' | 'is_template'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('copy_library')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setEntries(prev => prev.map(entry => 
        entry.id === id ? { ...entry, ...updates } : entry
      ));
      toast.success('Entry updated');
      return true;
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error('Failed to update entry');
      return false;
    }
  };

  // Delete an entry
  const deleteEntry = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('copy_library')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEntries(prev => prev.filter(entry => entry.id !== id));
      toast.success('Entry deleted');
      return true;
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
      return false;
    }
  };

  // Search and filter entries
  const searchEntries = useMemo(() => {
    return (
      query: string,
      filters: { category?: string; status?: string; isTemplate?: boolean; tags?: string[] }
    ): CopyLibraryEntry[] => {
      let filtered = entries;

      // Filter by status
      if (filters.status) {
        filtered = filtered.filter(e => e.status === filters.status);
      }

      // Filter by category
      if (filters.category) {
        filtered = filtered.filter(e => e.category === filters.category);
      }

      // Filter by template
      if (filters.isTemplate !== undefined) {
        filtered = filtered.filter(e => e.is_template === filters.isTemplate);
      }

      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        filtered = filtered.filter(e => {
          const allTags = [...e.ai_tags, ...e.manual_tags];
          return filters.tags!.some(tag => allTags.includes(tag));
        });
      }

      // Search by query
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(e =>
          e.subject_line.toLowerCase().includes(lowerQuery) ||
          e.body_preview?.toLowerCase().includes(lowerQuery) ||
          e.notes?.toLowerCase().includes(lowerQuery) ||
          e.ai_tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
          e.manual_tags.some(t => t.toLowerCase().includes(lowerQuery))
        );
      }

      return filtered;
    };
  }, [entries]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach(e => {
      e.ai_tags.forEach(t => tagSet.add(t));
      e.manual_tags.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [entries]);

  return {
    entries,
    loading,
    saving,
    generatingTags,
    saveToLibrary,
    updateEntry,
    deleteEntry,
    generateTags,
    searchEntries,
    allTags
  };
}
