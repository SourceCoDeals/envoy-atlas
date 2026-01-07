import { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, X, Loader2, Sparkles, Brain, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UploadedDocument {
  name: string;
  path: string;
  size: number;
}

export interface ExtractedIntelligence {
  painPoints: { content: string; context: string }[];
  terminology: { content: string; context: string }[];
  buyingTriggers: { content: string; context: string }[];
  objections: { content: string; context: string }[];
  languagePatterns: { content: string; context: string }[];
  competitorMentions: { content: string; context: string }[];
}

interface IndustryContextInputsProps {
  callTranscript: string;
  setCallTranscript: (value: string) => void;
  uploadedDocuments: UploadedDocument[];
  setUploadedDocuments: (docs: UploadedDocument[]) => void;
  workspaceId: string | undefined;
  targetIndustry?: string;
  extractedIntelligence?: ExtractedIntelligence | null;
  setExtractedIntelligence?: (intel: ExtractedIntelligence | null) => void;
}

export function IndustryContextInputs({
  callTranscript,
  setCallTranscript,
  uploadedDocuments,
  setUploadedDocuments,
  workspaceId,
  targetIndustry,
  extractedIntelligence,
  setExtractedIntelligence,
}: IndustryContextInputsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !workspaceId) return;

    setIsUploading(true);
    const newDocs: UploadedDocument[] = [];

    try {
      for (const file of Array.from(files)) {
        const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`${file.name}: Only PDF, TXT, DOC, DOCX files allowed`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: File too large (max 10MB)`);
          continue;
        }

        const filePath = `${workspaceId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
          .from('industry-documents')
          .upload(filePath, file);

        if (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        newDocs.push({
          name: file.name,
          path: filePath,
          size: file.size,
        });
      }

      if (newDocs.length) {
        setUploadedDocuments([...uploadedDocuments, ...newDocs]);
        toast.success(`Uploaded ${newDocs.length} document(s)`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload documents');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeDocument = async (doc: UploadedDocument) => {
    try {
      await supabase.storage
        .from('industry-documents')
        .remove([doc.path]);
      
      setUploadedDocuments(uploadedDocuments.filter(d => d.path !== doc.path));
      toast.success('Document removed');
    } catch (error) {
      console.error('Remove error:', error);
      toast.error('Failed to remove document');
    }
  };

  const processDocuments = async () => {
    if (!workspaceId || (!uploadedDocuments.length && !callTranscript)) {
      toast.error('Upload documents or paste a transcript first');
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-industry-documents', {
        body: {
          documentPaths: uploadedDocuments.map(d => d.path),
          callTranscript,
          targetIndustry: targetIndustry || 'general',
          workspaceId,
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
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.extracted && setExtractedIntelligence) {
        setExtractedIntelligence(data.extracted);
        toast.success(`Extracted ${data.stored_count} insights from your content`);
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process documents');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTotalInsights = () => {
    if (!extractedIntelligence) return 0;
    return (
      (extractedIntelligence.painPoints?.length || 0) +
      (extractedIntelligence.terminology?.length || 0) +
      (extractedIntelligence.buyingTriggers?.length || 0) +
      (extractedIntelligence.objections?.length || 0) +
      (extractedIntelligence.languagePatterns?.length || 0) +
      (extractedIntelligence.competitorMentions?.length || 0)
    );
  };

  const hasContent = uploadedDocuments.length > 0 || callTranscript.trim().length > 0;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Industry Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Document Upload */}
        <div className="space-y-2">
          <Label>Industry Documents</Label>
          <p className="text-xs text-muted-foreground">
            Upload PDFs, reports, or docs with industry insights
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !workspaceId}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Documents
              </>
            )}
          </Button>

          {uploadedDocuments.length > 0 && (
            <div className="space-y-2 mt-2">
              {uploadedDocuments.map((doc) => (
                <div
                  key={doc.path}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{doc.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({formatFileSize(doc.size)})
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(doc)}
                    className="h-6 w-6 p-0 shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call Transcript */}
        <div className="space-y-2">
          <Label>Call Transcript (Fireflies, etc.)</Label>
          <p className="text-xs text-muted-foreground">
            Paste call transcripts to extract objections, language patterns, and pain points
          </p>
          <Textarea
            placeholder="Paste your call transcript here...

Example:
[00:01:23] Prospect: Our main challenge is getting quality leads. We're spending a lot on ads but the conversion rate is terrible.
[00:01:45] Rep: I see. What would success look like for you?
..."
            value={callTranscript}
            onChange={(e) => setCallTranscript(e.target.value)}
            className="resize-none h-32 font-mono text-xs"
          />
          {callTranscript && (
            <p className="text-xs text-muted-foreground">
              {callTranscript.split(/\s+/).filter(Boolean).length} words
            </p>
          )}
        </div>

        {/* Process Button */}
        {hasContent && (
          <Button
            type="button"
            onClick={processDocuments}
            disabled={isProcessing || !workspaceId}
            className="w-full"
            variant={extractedIntelligence ? "outline" : "default"}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting Intelligence...
              </>
            ) : extractedIntelligence ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Re-process Documents
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Extract Intelligence with AI
              </>
            )}
          </Button>
        )}

        {/* Extracted Intelligence Preview */}
        {extractedIntelligence && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">
                {getTotalInsights()} insights extracted
              </span>
            </div>

            <div className="grid gap-2">
              {extractedIntelligence.painPoints?.length > 0 && (
                <IntelligenceSection 
                  label="Pain Points" 
                  items={extractedIntelligence.painPoints} 
                  variant="destructive"
                />
              )}
              {extractedIntelligence.terminology?.length > 0 && (
                <IntelligenceSection 
                  label="Terminology" 
                  items={extractedIntelligence.terminology} 
                  variant="secondary"
                />
              )}
              {extractedIntelligence.buyingTriggers?.length > 0 && (
                <IntelligenceSection 
                  label="Buying Triggers" 
                  items={extractedIntelligence.buyingTriggers} 
                  variant="default"
                />
              )}
              {extractedIntelligence.objections?.length > 0 && (
                <IntelligenceSection 
                  label="Objections" 
                  items={extractedIntelligence.objections} 
                  variant="outline"
                />
              )}
              {extractedIntelligence.languagePatterns?.length > 0 && (
                <IntelligenceSection 
                  label="Language Patterns" 
                  items={extractedIntelligence.languagePatterns} 
                  variant="secondary"
                />
              )}
              {extractedIntelligence.competitorMentions?.length > 0 && (
                <IntelligenceSection 
                  label="Competitors" 
                  items={extractedIntelligence.competitorMentions} 
                  variant="outline"
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntelligenceSection({ 
  label, 
  items, 
  variant 
}: { 
  label: string; 
  items: { content: string; context: string }[];
  variant: "default" | "secondary" | "destructive" | "outline";
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items : items.slice(0, 2);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Badge variant={variant} className="text-xs">
          {label} ({items.length})
        </Badge>
        {items.length > 2 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : `+${items.length - 2} more`}
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {displayItems.map((item, i) => (
          <div key={i} className="text-xs p-2 bg-muted/30 rounded">
            <p className="font-medium">{item.content}</p>
            {item.context && (
              <p className="text-muted-foreground mt-0.5 italic">"{item.context}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
