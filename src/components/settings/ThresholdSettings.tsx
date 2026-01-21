/**
 * Threshold Settings Component
 * 
 * Admin UI for configuring metric thresholds that were previously hardcoded.
 * Stores values in workspace_settings table.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useRBAC } from '@/hooks/useRBAC';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ThresholdConfig {
  // Email metrics
  email_bounce_rate_warning: number;
  email_bounce_rate_critical: number;
  email_reply_rate_good: number;
  email_reply_rate_warning: number;
  email_open_rate_good: number;
  email_open_rate_warning: number;
  email_positive_rate_good: number;
  
  // Call metrics
  call_connect_rate_good: number;
  call_connect_rate_warning: number;
  call_meeting_rate_good: number;
  call_meeting_rate_warning: number;
  call_dm_rate_good: number;
  
  // Data freshness
  data_stale_hours: number;
  data_critical_hours: number;
  
  // Sync settings
  sync_stale_minutes: number;
  sync_max_retries: number;
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  email_bounce_rate_warning: 5,
  email_bounce_rate_critical: 10,
  email_reply_rate_good: 3,
  email_reply_rate_warning: 1,
  email_open_rate_good: 50,
  email_open_rate_warning: 30,
  email_positive_rate_good: 2,
  
  call_connect_rate_good: 25,
  call_connect_rate_warning: 15,
  call_meeting_rate_good: 5,
  call_meeting_rate_warning: 2,
  call_dm_rate_good: 10,
  
  data_stale_hours: 24,
  data_critical_hours: 72,
  
  sync_stale_minutes: 5,
  sync_max_retries: 3,
};

export function ThresholdSettings() {
  const { currentWorkspace } = useWorkspace();
  const { hasPermission, isAdmin } = useRBAC();
  const queryClient = useQueryClient();
  const [localThresholds, setLocalThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current settings from clients.settings JSON field
  const { data: savedThresholds, isLoading } = useQuery({
    queryKey: ['workspace-thresholds', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return DEFAULT_THRESHOLDS;

      const { data, error } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', currentWorkspace.id)
        .maybeSingle();

      if (error || !data?.settings) return DEFAULT_THRESHOLDS;
      
      const settings = data.settings as { metric_thresholds?: Partial<ThresholdConfig> };
      return { ...DEFAULT_THRESHOLDS, ...(settings.metric_thresholds || {}) };
    },
    enabled: !!currentWorkspace?.id,
  });

  // Update local state when saved thresholds load
  useEffect(() => {
    if (savedThresholds) {
      setLocalThresholds(savedThresholds);
    }
  }, [savedThresholds]);

  // Track changes
  useEffect(() => {
    if (savedThresholds) {
      const changed = JSON.stringify(localThresholds) !== JSON.stringify(savedThresholds);
      setHasChanges(changed);
    }
  }, [localThresholds, savedThresholds]);

  // Save mutation - stores in clients.settings JSON field
  const saveMutation = useMutation({
    mutationFn: async (thresholds: ThresholdConfig) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      // First get existing settings
      const { data: existing } = await supabase
        .from('clients')
        .select('settings')
        .eq('id', currentWorkspace.id)
        .maybeSingle();

      const currentSettings = (existing?.settings || {}) as Record<string, unknown>;
      
      const newSettings = JSON.parse(JSON.stringify({ ...currentSettings, metric_thresholds: thresholds }));
      
      const { error } = await supabase
        .from('clients')
        .update({
          settings: newSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentWorkspace.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Thresholds saved successfully');
      queryClient.invalidateQueries({ queryKey: ['workspace-thresholds'] });
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error('Failed to save thresholds', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const handleChange = (key: keyof ThresholdConfig, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalThresholds(prev => ({ ...prev, [key]: numValue }));
  };

  const handleReset = () => {
    setLocalThresholds(DEFAULT_THRESHOLDS);
  };

  const handleSave = () => {
    saveMutation.mutate(localThresholds);
  };

  if (!hasPermission('manage_thresholds') && !isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-warning" />
          <p>Admin access required to configure thresholds</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const ThresholdInput = ({ 
    label, 
    keyName, 
    suffix = '%',
    description 
  }: { 
    label: string; 
    keyName: keyof ThresholdConfig; 
    suffix?: string;
    description?: string;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.1"
          min="0"
          value={localThresholds[keyName]}
          onChange={(e) => handleChange(keyName, e.target.value)}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Metric Thresholds</CardTitle>
            <CardDescription>
              Configure warning and critical thresholds for performance metrics
            </CardDescription>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Unsaved changes
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email" className="space-y-4">
          <TabsList>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="calling">Calling</TabsTrigger>
            <TabsTrigger value="data">Data & Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Bounce Rate Thresholds
                </h4>
                <ThresholdInput
                  label="Warning Level" 
                  keyName="email_bounce_rate_warning"
                  description="Show warning when bounce rate exceeds this"
                />
                <ThresholdInput 
                  label="Critical Level" 
                  keyName="email_bounce_rate_critical"
                  description="Show critical alert when bounce rate exceeds this"
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Reply Rate Thresholds
                </h4>
                <ThresholdInput 
                  label="Good Performance"
                  keyName="email_reply_rate_good"
                  description="Green badge when reply rate meets this"
                />
                <ThresholdInput 
                  label="Warning Level" 
                  keyName="email_reply_rate_warning"
                  description="Yellow badge when below this"
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm">Open Rate Thresholds</h4>
                <ThresholdInput 
                  label="Good Performance" 
                  keyName="email_open_rate_good"
                />
                <ThresholdInput 
                  label="Warning Level" 
                  keyName="email_open_rate_warning"
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm">Positive Reply Rate</h4>
                <ThresholdInput 
                  label="Good Performance" 
                  keyName="email_positive_rate_good"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calling" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Connect Rate</h4>
                <ThresholdInput 
                  label="Good Performance" 
                  keyName="call_connect_rate_good"
                  description="Expected connect rate for quality data"
                />
                <ThresholdInput 
                  label="Warning Level" 
                  keyName="call_connect_rate_warning"
                  description="Below this may indicate data issues"
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm">Meeting Booking Rate</h4>
                <ThresholdInput 
                  label="Good Performance" 
                  keyName="call_meeting_rate_good"
                />
                <ThresholdInput 
                  label="Warning Level" 
                  keyName="call_meeting_rate_warning"
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm">Decision Maker Rate</h4>
                <ThresholdInput 
                  label="Good Performance" 
                  keyName="call_dm_rate_good"
                  description="% of conversations with decision makers"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Data Freshness</h4>
                <ThresholdInput 
                  label="Stale After" 
                  keyName="data_stale_hours"
                  suffix="hours"
                  description="Show stale indicator after this many hours"
                />
                <ThresholdInput 
                  label="Critical After" 
                  keyName="data_critical_hours"
                  suffix="hours"
                  description="Show critical indicator after this many hours"
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm">Sync Health</h4>
                <ThresholdInput 
                  label="Sync Stale After" 
                  keyName="sync_stale_minutes"
                  suffix="minutes"
                  description="Consider sync stuck after this duration"
                />
                <ThresholdInput 
                  label="Max Retries" 
                  keyName="sync_max_retries"
                  suffix="attempts"
                  description="Number of retry attempts before failing"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-6 border-t mt-6">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saveMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ThresholdSettings;
