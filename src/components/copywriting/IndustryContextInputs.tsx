import { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IndustryContextInputsProps {
  callTranscript: string;
  setCallTranscript: (value: string) => void;
  uploadedDocuments: UploadedDocument[];
  setUploadedDocuments: (docs: UploadedDocument[]) => void;
  workspaceId: string | undefined;
}

export interface UploadedDocument {
  name: string;
  path: string;
  size: number;
}

export function IndustryContextInputs({
  callTranscript,
  setCallTranscript,
  uploadedDocuments,
  setUploadedDocuments,
  workspaceId,
}: IndustryContextInputsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !workspaceId) return;

    setIsUploading(true);
    const newDocs: UploadedDocument[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`${file.name}: Only PDF, TXT, DOC, DOCX files allowed`);
          continue;
        }

        // Validate size (10MB max)
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Industry Context</CardTitle>
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

          {/* Uploaded files list */}
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
            className="resize-none h-40 font-mono text-xs"
          />
          {callTranscript && (
            <p className="text-xs text-muted-foreground">
              {callTranscript.split(/\s+/).filter(Boolean).length} words
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
