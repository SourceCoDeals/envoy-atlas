import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CopyLibraryEntry {
  id: string;
  engagement_id: string | null;
  variant_id: string | null;
  title: string;
  subject_line: string;
  body_html: string | null;
  body_plain: string | null;
  performance_snapshot: {
    sent_count?: number;
    reply_rate?: number;
    positive_rate?: number;
    open_rate?: number;
    saved_at?: string;
  } | null;
  tags: string[];
  notes: string | null;
  category: string | null;
  is_template: boolean;
  total_sent: number;
  total_replied: number;
  reply_rate: number;
  positive_rate: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveToLibraryOptions {
  category?: string;
  notes?: string;
  is_template?: boolean;
  tags?: string[];
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
        // Get engagements for this client
        const { data: engagements } = await supabase
          .from('engagements')
          .select('id')
          .eq('client_id', currentWorkspace.id);

        const engagementIds = (engagements || []).map(e => e.id);

        if (engagementIds.length === 0) {
          setEntries([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('copy_library')
          .select('*')
          .in('engagement_id', engagementIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const transformed: CopyLibraryEntry[] = (data || []).map(entry => ({
          id: entry.id,
          engagement_id: entry.engagement_id,
          variant_id: entry.variant_id,
          title: entry.title,
          subject_line: entry.subject_line,
          body_html: entry.body_html,
          body_plain: entry.body_plain,
          performance_snapshot: entry.performance_snapshot as CopyLibraryEntry['performance_snapshot'],
          tags: Array.isArray(entry.tags) ? entry.tags : [],
          notes: entry.notes,
          category: entry.category,
          is_template: entry.is_template || false,
          total_sent: entry.total_sent || 0,
          total_replied: entry.total_replied || 0,
          reply_rate: Number(entry.reply_rate) || 0,
          positive_rate: Number(entry.positive_rate) || 0,
          created_by: entry.created_by,
          created_at: entry.created_at,
          updated_at: entry.updated_at,
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
      title: string;
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
    },
    options: SaveToLibraryOptions = {}
  ): Promise<CopyLibraryEntry | null> => {
    if (!currentWorkspace?.id || !user?.id) {
      toast.error('No workspace or user found');
      return null;
    }

    setSaving(true);
    try {
      // Get first engagement for this client
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id)
        .limit(1);

      const engagementId = engagements?.[0]?.id;

      let tags: string[] = options.tags || [];
      let category = options.category || 'custom';

      // Generate AI tags if requested
      if (options.generateTags !== false) {
        const tagResult = await generateTags(
          variantData.subject_line,
          variantData.body_html || variantData.body_plain,
          category
        );
        if (tagResult) {
          tags = [...tags, ...tagResult.ai_tags];
          if (!options.category) {
            category = tagResult.suggested_category;
          }
        }
      }

      const insertData = {
        engagement_id: engagementId,
        variant_id: variantData.variant_id || null,
        title: variantData.title,
        subject_line: variantData.subject_line,
        body_html: variantData.body_html || null,
        body_plain: variantData.body_plain || null,
        performance_snapshot: {
          ...variantData.performance,
          saved_at: new Date().toISOString()
        },
        tags,
        notes: options.notes || null,
        category,
        is_template: options.is_template || false,
        total_sent: variantData.performance?.sent_count || 0,
        total_replied: 0,
        reply_rate: variantData.performance?.reply_rate || 0,
        positive_rate: variantData.performance?.positive_rate || 0,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('copy_library')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const newEntry: CopyLibraryEntry = {
        id: data.id,
        engagement_id: data.engagement_id,
        variant_id: data.variant_id,
        title: data.title,
        subject_line: data.subject_line,
        body_html: data.body_html,
        body_plain: data.body_plain,
        performance_snapshot: data.performance_snapshot as CopyLibraryEntry['performance_snapshot'],
        tags: Array.isArray(data.tags) ? data.tags : [],
        notes: data.notes,
        category: data.category,
        is_template: data.is_template || false,
        total_sent: data.total_sent || 0,
        total_replied: data.total_replied || 0,
        reply_rate: Number(data.reply_rate) || 0,
        positive_rate: Number(data.positive_rate) || 0,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
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
    updates: Partial<Pick<CopyLibraryEntry, 'notes' | 'tags' | 'category' | 'is_template'>>
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
      filters: { category?: string; isTemplate?: boolean; tags?: string[] }
    ): CopyLibraryEntry[] => {
      let filtered = entries;

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
          return filters.tags!.some(tag => e.tags.includes(tag));
        });
      }

      // Search by query
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(e =>
          e.subject_line.toLowerCase().includes(lowerQuery) ||
          e.body_plain?.toLowerCase().includes(lowerQuery) ||
          e.notes?.toLowerCase().includes(lowerQuery) ||
          e.title.toLowerCase().includes(lowerQuery) ||
          e.tags.some(t => t.toLowerCase().includes(lowerQuery))
        );
      }

      return filtered;
    };
  }, [entries]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach(e => {
      e.tags.forEach(t => tagSet.add(t));
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
