import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';

export interface CopyVariation {
  index: number;
  subject_line: string;
  body: string;
  patterns_used: string[];
  quality_score: number;
  word_count: number;
  char_count?: number;
  you_i_ratio?: number;
  variation_style: string;
  validation: {
    is_valid: boolean;
    issues: string[];
    warnings: string[];
  };
  quality_breakdown?: {
    constraints: number;
    patterns: number;
    guideAlignment: number;
    spam: number;
    readability: number;
    youIRatio: number;
  };
}

export interface GenerationContext {
  best_practices_count: number;
  winning_patterns_count: number;
  top_copy_count: number;
  industry_intel_count: number;
}

export interface GenerationResult {
  variations: CopyVariation[];
  context_used: GenerationContext;
}

export interface SequenceStepInput {
  id: string;
  channel: string;
  stepType: string;
  delayDays: number;
}

export interface GenerationRequest {
  // Single step mode (legacy)
  channel?: string;
  sequenceStep?: string;
  // Sequence mode
  sequenceSteps?: SequenceStepInput[];
  // Common fields
  buyerName?: string;
  buyerWebsite?: string;
  targetIndustry?: string;
  painPoints?: string;
  emailGoal?: string;
  callTranscript?: string;
  documentPaths?: string[];
  tone: string;
  variationCount?: number;
}

export interface SequenceStepOutput {
  stepIndex: number;
  channel: string;
  stepType: string;
  delayDays: number;
  variations: CopyVariation[];
}

export interface SequenceGenerationResult {
  steps: SequenceStepOutput[];
  context_used: GenerationContext;
}

export interface BestPractice {
  id: string;
  channel: string;
  category: string;
  practice_type: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  performance_lift: number | null;
  source: string | null;
}

export function useCopywritingStudio() {
  const { currentWorkspace } = useWorkspace();
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [sequenceResult, setSequenceResult] = useState<SequenceGenerationResult | null>(null);
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [isLoadingPractices, setIsLoadingPractices] = useState(false);

  const fetchBestPractices = useCallback(async (channel?: string) => {
    setIsLoadingPractices(true);
    try {
      // Best practices would come from copy_patterns or a dedicated config
      // For now, return empty array as channel_best_practices doesn't exist
      setBestPractices([]);
    } catch (error) {
      console.error('Error fetching best practices:', error);
      toast.error('Failed to load best practices');
    } finally {
      setIsLoadingPractices(false);
    }
  }, []);

  const generateCopy = useCallback(async (request: GenerationRequest) => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return null;
    }

    setIsGenerating(true);
    setResult(null);
    setSequenceResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-copy', {
        body: {
          ...request,
          clientId: currentWorkspace.id,
        },
      });

      if (error) {
        if (error.message?.includes('429')) {
          toast.error('Rate limit exceeded. Please try again in a moment.');
        } else if (error.message?.includes('402')) {
          toast.error('Credits depleted. Please add credits to continue.');
        } else {
          throw error;
        }
        return null;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Check if it's a sequence result or single result
      if (data?.steps) {
        setSequenceResult(data);
        const totalVariations = data.steps.reduce((acc: number, s: SequenceStepOutput) => acc + (s.variations?.length || 0), 0);
        toast.success(`Generated ${data.steps.length} steps with ${totalVariations} variations`);
      } else {
        setResult(data);
        toast.success(`Generated ${data.variations?.length || 0} variations`);
      }
      return data;
    } catch (error) {
      console.error('Error generating copy:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate copy');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [currentWorkspace?.id]);

  const saveToLibrary = useCallback(async (variation: CopyVariation, category: string) => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return false;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get first engagement for this client
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id)
        .limit(1);

      const engagementId = engagements?.[0]?.id;

      const { error } = await supabase
        .from('copy_library')
        .insert({
          engagement_id: engagementId,
          created_by: user.id,
          title: variation.subject_line.substring(0, 50),
          subject_line: variation.subject_line,
          body_html: variation.body,
          body_plain: variation.body,
          category,
          is_template: true,
          tags: variation.patterns_used,
          notes: `Generated by Copywriting Studio. Style: ${variation.variation_style}. Score: ${variation.quality_score}/100`,
        });

      if (error) throw error;
      toast.success('Saved to Copy Library');
      return true;
    } catch (error) {
      console.error('Error saving to library:', error);
      toast.error('Failed to save to library');
      return false;
    }
  }, [currentWorkspace?.id]);

  return {
    isGenerating,
    result,
    sequenceResult,
    bestPractices,
    isLoadingPractices,
    generateCopy,
    fetchBestPractices,
    saveToLibrary,
    clearResult: () => { setResult(null); setSequenceResult(null); },
  };
}
