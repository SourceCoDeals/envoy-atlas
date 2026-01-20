import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { CallingMetricsConfig, ScoreThresholds, DEFAULT_CALLING_CONFIG } from '@/lib/callingConfig';
import { Save, RotateCcw, Loader2, Phone } from 'lucide-react';

interface ScoreThresholdEditorProps {
  label: string;
  value: ScoreThresholds;
  onChange: (value: ScoreThresholds) => void;
}

function ScoreThresholdEditor({ label, value, onChange }: ScoreThresholdEditorProps) {
  return (
    <div className="space-y-2">
      <Label className="font-medium">{label}</Label>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label className="text-xs text-success">Excellent ≥</Label>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="10"
            value={value.excellent}
            onChange={(e) => onChange({ ...value, excellent: parseFloat(e.target.value) || 8 })}
          />
        </div>
        <div>
          <Label className="text-xs text-primary">Good ≥</Label>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="10"
            value={value.good}
            onChange={(e) => onChange({ ...value, good: parseFloat(e.target.value) || 6 })}
          />
        </div>
        <div>
          <Label className="text-xs text-warning">Average ≥</Label>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="10"
            value={value.average}
            onChange={(e) => onChange({ ...value, average: parseFloat(e.target.value) || 4 })}
          />
        </div>
        <div>
          <Label className="text-xs text-destructive">Poor &lt;</Label>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="10"
            value={value.poor}
            onChange={(e) => onChange({ ...value, poor: parseFloat(e.target.value) || 2 })}
          />
        </div>
      </div>
    </div>
  );
}

export function CallingMetricsSettings() {
  const { config, isLoading, updateConfig, isUpdating, resetToDefaults, isResetting } = useCallingConfig();
  const [localConfig, setLocalConfig] = useState<CallingMetricsConfig>(config);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local config when external config changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Detect changes
  useEffect(() => {
    setHasChanges(JSON.stringify(localConfig) !== JSON.stringify(config));
  }, [localConfig, config]);

  const handleSave = () => {
    updateConfig(localConfig);
  };

  const handleReset = () => {
    setLocalConfig(config);
    setHasChanges(false);
  };

  const handleResetToDefaults = () => {
    resetToDefaults();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Calling Metrics Configuration</CardTitle>
                <CardDescription>
                  Configure thresholds and benchmarks for all calling analytics
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleResetToDefaults}
                disabled={isResetting}
              >
                {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Defaults</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges}
              >
                Undo
              </Button>
              <Button 
                size="sm"
                onClick={handleSave} 
                disabled={isUpdating || !hasChanges}
              >
                {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="scores" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scores">Score Thresholds</TabsTrigger>
          <TabsTrigger value="calls">Call Settings</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Flags</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
        </TabsList>

        {/* Score Thresholds Tab */}
        <TabsContent value="scores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Score Thresholds</CardTitle>
              <CardDescription>
                Define what score ranges are considered Excellent, Good, Average, and Poor for each AI dimension.
                These thresholds affect color coding and status badges throughout the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScoreThresholdEditor
                label="Overall Quality Score"
                value={localConfig.overallQualityThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, overallQualityThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Seller Interest Score"
                value={localConfig.sellerInterestThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, sellerInterestThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Script Adherence Score"
                value={localConfig.scriptAdherenceThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, scriptAdherenceThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Question Adherence Score"
                value={localConfig.questionAdherenceThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, questionAdherenceThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Objection Handling Score"
                value={localConfig.objectionHandlingThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, objectionHandlingThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Conversation Quality Score"
                value={localConfig.conversationQualityThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, conversationQualityThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Rapport Building Score"
                value={localConfig.rapportBuildingThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, rapportBuildingThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Value Proposition Score"
                value={localConfig.valuePropositionThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, valuePropositionThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Next Steps Clarity Score"
                value={localConfig.nextStepsClarityThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, nextStepsClarityThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Personal Insights Score"
                value={localConfig.personalInsightsThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, personalInsightsThresholds: v })}
              />
              <ScoreThresholdEditor
                label="Valuation Discussion Score"
                value={localConfig.valuationDiscussionThresholds}
                onChange={(v) => setLocalConfig({ ...localConfig, valuationDiscussionThresholds: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Question Coverage</CardTitle>
              <CardDescription>
                Configure the total required questions and thresholds for question coverage scoring.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Total Required Questions</Label>
                <Input
                  type="number"
                  min="1"
                  value={localConfig.questionCoverageTotal}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    questionCoverageTotal: parseInt(e.target.value) || 17 
                  })}
                />
              </div>
              <div>
                <Label>Good Threshold (min questions)</Label>
                <Input
                  type="number"
                  min="1"
                  value={localConfig.questionCoverageGoodThreshold}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    questionCoverageGoodThreshold: parseInt(e.target.value) || 12 
                  })}
                />
              </div>
              <div>
                <Label>Warning Threshold (below this)</Label>
                <Input
                  type="number"
                  min="1"
                  value={localConfig.questionCoverageWarningThreshold}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    questionCoverageWarningThreshold: parseInt(e.target.value) || 6 
                  })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Objection Resolution</CardTitle>
              <CardDescription>
                Thresholds for objection resolution rate (% of objections resolved).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Good Threshold (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={localConfig.objectionResolutionGoodThreshold}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    objectionResolutionGoodThreshold: parseInt(e.target.value) || 80 
                  })}
                />
              </div>
              <div>
                <Label>Warning Threshold (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={localConfig.objectionResolutionWarningThreshold}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    objectionResolutionWarningThreshold: parseInt(e.target.value) || 50 
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Settings Tab */}
        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Duration Benchmarks</CardTitle>
              <CardDescription>
                Define optimal call duration ranges (in seconds).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Too Short (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  value={localConfig.callDurationTooShort}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    callDurationTooShort: parseInt(e.target.value) || 60 
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">Calls shorter than this are flagged</p>
              </div>
              <div>
                <Label>Min Optimal (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  value={localConfig.callDurationMinOptimal}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    callDurationMinOptimal: parseInt(e.target.value) || 180 
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">Start of optimal range</p>
              </div>
              <div>
                <Label>Max Optimal (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  value={localConfig.callDurationMaxOptimal}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    callDurationMaxOptimal: parseInt(e.target.value) || 300 
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">End of optimal range</p>
              </div>
              <div>
                <Label>Too Long (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  value={localConfig.callDurationTooLong}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    callDurationTooLong: parseInt(e.target.value) || 600 
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">Calls longer than this may need review</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interest Classification</CardTitle>
              <CardDescription>
                Define which "Interest in Selling" values are considered positive or negative.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Positive Interest Values</Label>
                <Input
                  value={localConfig.interestValuesPositive.join(', ')}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    interestValuesPositive: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated (e.g., "yes, maybe")</p>
              </div>
              <div>
                <Label>Negative Interest Values</Label>
                <Input
                  value={localConfig.interestValuesNegative.join(', ')}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    interestValuesNegative: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated (e.g., "no")</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top & Worst Calls</CardTitle>
              <CardDescription>
                Define score thresholds for identifying top and worst calls.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Top Calls Min Score</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={localConfig.topCallsMinScore}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    topCallsMinScore: parseFloat(e.target.value) || 7 
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">Overall score ≥ this = Top Call</p>
              </div>
              <div>
                <Label>Worst Calls Max Score</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={localConfig.worstCallsMaxScore}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    worstCallsMaxScore: parseFloat(e.target.value) || 3 
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">Overall score ≤ this = Worst Call</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts & Flags Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Coaching Alerts</CardTitle>
              <CardDescription>
                Calls with scores below these thresholds will be flagged for coaching review.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Overall Quality Alert Threshold</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={localConfig.coachingAlertOverallQuality}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    coachingAlertOverallQuality: parseFloat(e.target.value) || 4 
                  })}
                />
              </div>
              <div>
                <Label>Script Adherence Alert Threshold</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={localConfig.coachingAlertScriptAdherence}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    coachingAlertScriptAdherence: parseFloat(e.target.value) || 4 
                  })}
                />
              </div>
              <div>
                <Label>Question Adherence Alert Threshold</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={localConfig.coachingAlertQuestionAdherence}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    coachingAlertQuestionAdherence: parseFloat(e.target.value) || 4 
                  })}
                />
              </div>
              <div>
                <Label>Objection Handling Alert Threshold</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={localConfig.coachingAlertObjectionHandling}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    coachingAlertObjectionHandling: parseFloat(e.target.value) || 4 
                  })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hot Lead Detection</CardTitle>
              <CardDescription>
                Configure when a call should be flagged as a hot lead.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Min Seller Interest Score</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={localConfig.hotLeadInterestScore}
                    onChange={(e) => setLocalConfig({ 
                      ...localConfig, 
                      hotLeadInterestScore: parseFloat(e.target.value) || 8 
                    })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={localConfig.hotLeadRequiresInterestYes}
                  onCheckedChange={(checked) => setLocalConfig({ 
                    ...localConfig, 
                    hotLeadRequiresInterestYes: checked 
                  })}
                />
                <Label>Also require "Interest in Selling" = Yes</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display Settings</CardTitle>
              <CardDescription>
                Configure how metrics are displayed throughout the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs">
                <Label>Score Decimal Places</Label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  value={localConfig.scoresDecimalPlaces}
                  onChange={(e) => setLocalConfig({ 
                    ...localConfig, 
                    scoresDecimalPlaces: parseInt(e.target.value) || 1 
                  })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={localConfig.showScoreJustifications}
                  onCheckedChange={(checked) => setLocalConfig({ 
                    ...localConfig, 
                    showScoreJustifications: checked 
                  })}
                />
                <Label>Show AI score justifications in call details</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
