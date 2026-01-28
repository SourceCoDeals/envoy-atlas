import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Brain, CheckCircle, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

interface ProposedMapping {
  campaignId: string;
  campaignName: string;
  currentEngagementId: string;
  currentEngagementName: string;
  proposedEngagementId: string;
  proposedEngagementName: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  totalSent: number;
  status: string | null;
}

interface CampaignRemapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function CampaignRemapDialog({ open, onOpenChange, onComplete }: CampaignRemapDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposedMappings, setProposedMappings] = useState<ProposedMapping[]>([]);
  const [selectedMappings, setSelectedMappings] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalCampaigns: number; totalEngagements: number } | null>(null);

  // Fetch AI remapping suggestions when dialog opens
  useEffect(() => {
    if (open && currentWorkspace?.id) {
      fetchRemappingSuggestions();
    }
  }, [open, currentWorkspace?.id]);

  const fetchRemappingSuggestions = async () => {
    if (!currentWorkspace?.id) return;

    setLoading(true);
    setError(null);
    setProposedMappings([]);
    setSelectedMappings(new Set());

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-remap-campaigns', {
        body: { 
          workspace_id: currentWorkspace.id,
          dry_run: true
        }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setProposedMappings(data.proposedMappings || []);
      setStats({
        totalCampaigns: data.totalCampaigns || 0,
        totalEngagements: data.totalEngagements || 0
      });

      // Auto-select high confidence mappings
      const highConfidence = (data.proposedMappings || [])
        .filter((m: ProposedMapping) => m.confidence === 'high')
        .map((m: ProposedMapping) => m.campaignId);
      setSelectedMappings(new Set(highConfidence));

    } catch (err) {
      console.error('Failed to fetch remapping suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMappings = async () => {
    if (selectedMappings.size === 0) {
      toast.warning('No mappings selected');
      return;
    }

    const mappingsToApply = proposedMappings.filter(m => selectedMappings.has(m.campaignId));
    
    setApplying(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-remap-campaigns', {
        body: { 
          workspace_id: currentWorkspace?.id,
          apply_mappings: mappingsToApply
        }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      toast.success(`Successfully remapped ${data.applied} campaigns`);
      
      if (data.errors > 0) {
        toast.warning(`${data.errors} campaigns failed to update`);
      }

      onOpenChange(false);
      onComplete?.();

    } catch (err) {
      console.error('Failed to apply mappings:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to apply mappings');
    } finally {
      setApplying(false);
    }
  };

  const toggleMapping = (campaignId: string) => {
    const newSelected = new Set(selectedMappings);
    if (newSelected.has(campaignId)) {
      newSelected.delete(campaignId);
    } else {
      newSelected.add(campaignId);
    }
    setSelectedMappings(newSelected);
  };

  const selectAll = () => {
    setSelectedMappings(new Set(proposedMappings.map(m => m.campaignId)));
  };

  const selectNone = () => {
    setSelectedMappings(new Set());
  };

  const selectByConfidence = (confidence: 'high' | 'medium' | 'low') => {
    const matching = proposedMappings
      .filter(m => m.confidence === confidence)
      .map(m => m.campaignId);
    setSelectedMappings(new Set([...selectedMappings, ...matching]));
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return (
          <Badge className="bg-success/20 text-success border-success/30 gap-1">
            <CheckCircle className="h-3 w-3" />
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Medium
          </Badge>
        );
      case 'low':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
            <XCircle className="h-3 w-3" />
            Low
          </Badge>
        );
    }
  };

  const highCount = proposedMappings.filter(m => m.confidence === 'high').length;
  const mediumCount = proposedMappings.filter(m => m.confidence === 'medium').length;
  const lowCount = proposedMappings.filter(m => m.confidence === 'low').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Campaign Remapping
          </DialogTitle>
          <DialogDescription>
            Review AI-suggested campaign-to-engagement mappings. Select the ones you want to apply.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing campaign names with AI...</p>
              <p className="text-sm text-muted-foreground">This may take a minute for large datasets</p>
            </div>
          ) : error ? (
            <Alert className="border-destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : proposedMappings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <CheckCircle className="h-12 w-12 text-success" />
              <p className="text-lg font-medium">All campaigns appear to be correctly mapped!</p>
              <p className="text-muted-foreground text-sm">
                Analyzed {stats?.totalCampaigns || 0} campaigns across {stats?.totalEngagements || 0} engagements
              </p>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {proposedMappings.length} campaigns need remapping:
                </span>
                <Button variant="ghost" size="sm" onClick={() => selectByConfidence('high')} className="gap-1">
                  <CheckCircle className="h-3 w-3 text-success" />
                  {highCount} high
                </Button>
                <Button variant="ghost" size="sm" onClick={() => selectByConfidence('medium')} className="gap-1">
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  {mediumCount} medium
                </Button>
                <Button variant="ghost" size="sm" onClick={() => selectByConfidence('low')} className="gap-1">
                  <XCircle className="h-3 w-3 text-destructive" />
                  {lowCount} low
                </Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="outline" size="sm" onClick={selectNone}>Clear</Button>
              </div>

              {/* Mappings list */}
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {proposedMappings.map((mapping) => (
                    <div
                      key={mapping.campaignId}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        selectedMappings.has(mapping.campaignId) 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border bg-card'
                      }`}
                    >
                      <Checkbox
                        checked={selectedMappings.has(mapping.campaignId)}
                        onCheckedChange={() => toggleMapping(mapping.campaignId)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{mapping.campaignName}</span>
                          {getConfidenceBadge(mapping.confidence)}
                          {mapping.status && (
                            <Badge variant="outline" className="text-xs">
                              {mapping.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="truncate max-w-[150px]">{mapping.currentEngagementName}</span>
                          <ArrowRight className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate max-w-[150px] text-foreground font-medium">
                            {mapping.proposedEngagementName}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {mapping.reasoning}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mapping.totalSent.toLocaleString()} emails sent
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <span className="text-sm text-muted-foreground flex-1">
              {selectedMappings.size} of {proposedMappings.length} selected
            </span>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApplyMappings} 
              disabled={applying || selectedMappings.size === 0}
            >
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                `Apply ${selectedMappings.size} Changes`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
