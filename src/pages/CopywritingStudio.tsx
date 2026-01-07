import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2, Sparkles } from 'lucide-react';
import { useCopywritingStudio } from '@/hooks/useCopywritingStudio';
import { useWorkspace } from '@/hooks/useWorkspace';
import { GeneratorInputs } from '@/components/copywriting/GeneratorInputs';
import { IndustryContextInputs, UploadedDocument, ExtractedIntelligence } from '@/components/copywriting/IndustryContextInputs';
import { GeneratedVariations } from '@/components/copywriting/GeneratedVariations';
import { BestPracticesPanel } from '@/components/copywriting/BestPracticesPanel';
import { SequenceBuilder, SequenceStep } from '@/components/copywriting/SequenceBuilder';
import { SequenceOutput } from '@/components/copywriting/SequenceOutput';

export default function CopywritingStudio() {
  const { currentWorkspace } = useWorkspace();
  
  // Context inputs (shared across sequence)
  const [buyerName, setBuyerName] = useState('');
  const [buyerWebsite, setBuyerWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [painPoints, setPainPoints] = useState('');
  const [emailGoal, setEmailGoal] = useState('');
  const [tone, setTone] = useState('conversational');
  
  // Sequence builder state
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([
    { id: crypto.randomUUID(), channel: 'email', stepType: 'first_touch', delayDays: 0 },
  ]);
  
  // Industry context state
  const [callTranscript, setCallTranscript] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [extractedIntelligence, setExtractedIntelligence] = useState<ExtractedIntelligence | null>(null);

  const { 
    isGenerating, 
    result, 
    sequenceResult,
    bestPractices, 
    isLoadingPractices,
    generateCopy, 
    fetchBestPractices,
    saveToLibrary,
    clearResult 
  } = useCopywritingStudio();

  const handleGenerate = () => {
    generateCopy({
      sequenceSteps: sequenceSteps.map(s => ({
        id: s.id,
        channel: s.channel,
        stepType: s.stepType,
        delayDays: s.delayDays,
      })),
      buyerName: buyerName || undefined,
      buyerWebsite: buyerWebsite || undefined,
      targetIndustry: industry || undefined,
      painPoints: painPoints || undefined,
      emailGoal: emailGoal || undefined,
      callTranscript: callTranscript || undefined,
      documentPaths: uploadedDocuments.length ? uploadedDocuments.map(d => d.path) : undefined,
      tone,
      variationCount: 2,
    });
  };

  // Get unique channels from sequence for best practices
  const uniqueChannels = [...new Set(sequenceSteps.map(s => s.channel))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Copywriting Studio</h1>
              <p className="text-muted-foreground text-sm">
                AI-powered multi-channel sequence generation
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Inputs */}
          <div className="lg:col-span-4 space-y-4">
            <SequenceBuilder
              steps={sequenceSteps}
              setSteps={setSequenceSteps}
            />

            <GeneratorInputs
              buyerName={buyerName}
              setBuyerName={setBuyerName}
              buyerWebsite={buyerWebsite}
              setBuyerWebsite={setBuyerWebsite}
              industry={industry}
              setIndustry={setIndustry}
              painPoints={painPoints}
              setPainPoints={setPainPoints}
              emailGoal={emailGoal}
              setEmailGoal={setEmailGoal}
              tone={tone}
              setTone={setTone}
            />

            <IndustryContextInputs
              callTranscript={callTranscript}
              setCallTranscript={setCallTranscript}
              uploadedDocuments={uploadedDocuments}
              setUploadedDocuments={setUploadedDocuments}
              workspaceId={currentWorkspace?.id}
              targetIndustry={industry}
              extractedIntelligence={extractedIntelligence}
              setExtractedIntelligence={setExtractedIntelligence}
            />

            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || sequenceSteps.length === 0}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating {sequenceSteps.length} step{sequenceSteps.length !== 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Sequence ({sequenceSteps.length} step{sequenceSteps.length !== 1 ? 's' : ''})
                </>
              )}
            </Button>
          </div>

          {/* Center Panel - Generated Output */}
          <div className="lg:col-span-5">
            {sequenceResult?.steps?.length ? (
              <SequenceOutput
                sequenceOutput={sequenceResult.steps}
                onSaveToLibrary={saveToLibrary}
              />
            ) : result?.variations?.length ? (
              <GeneratedVariations
                variations={result.variations}
                contextUsed={result.context_used}
                onSaveToLibrary={saveToLibrary}
              />
            ) : (
              <div className="bg-card/30 border border-dashed border-border/50 rounded-lg p-8 h-full flex flex-col items-center justify-center text-center">
                <Wand2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No sequence generated yet
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm">
                  Build your sequence steps, add buyer context, and click "Generate Sequence" 
                  to create AI-powered copy for each touchpoint.
                </p>
              </div>
            )}
          </div>

          {/* Right Panel - Best Practices */}
          <div className="lg:col-span-3">
            <BestPracticesPanel
              channel={uniqueChannels[0] || 'email'}
              bestPractices={bestPractices}
              isLoading={isLoadingPractices}
              onRefresh={fetchBestPractices}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
