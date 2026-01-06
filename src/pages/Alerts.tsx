import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Bell, 
  BellRing,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Ban,
  TrendingDown,
  ThumbsUp,
  Settings,
  Trash2,
  Check,
  Eye,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface AlertConfig {
  id: string;
  alert_type: string;
  threshold_value: number;
  is_enabled: boolean;
  notify_email: boolean;
  notify_slack: boolean;
  slack_webhook_url: string | null;
}

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

const ALERT_TYPES = [
  { 
    id: 'spam_complaint_spike', 
    name: 'Spam Complaint Spike',
    description: 'Alert when spam complaint rate exceeds threshold',
    icon: ShieldAlert,
    defaultThreshold: 0.3,
    unit: '%',
    color: 'text-destructive',
  },
  { 
    id: 'bounce_rate_warning', 
    name: 'Bounce Rate Warning',
    description: 'Alert when bounce rate exceeds threshold',
    icon: Ban,
    defaultThreshold: 5,
    unit: '%',
    color: 'text-warning',
  },
  { 
    id: 'open_rate_drop', 
    name: 'Open Rate Drop',
    description: 'Alert when open rate drops below baseline',
    icon: TrendingDown,
    defaultThreshold: 20,
    unit: '% below baseline',
    color: 'text-warning',
  },
  { 
    id: 'hot_lead_alert', 
    name: 'Hot Lead Alert',
    description: 'Instant notification for positive responses',
    icon: ThumbsUp,
    defaultThreshold: 1,
    unit: 'trigger immediately',
    color: 'text-success',
  },
];

export default function Alerts() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [editingConfigs, setEditingConfigs] = useState<Map<string, Partial<AlertConfig>>>(new Map());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchData();
    }
  }, [currentWorkspace?.id]);

  const fetchData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Fetch alert configs
      const { data: configData, error: configError } = await supabase
        .from('alert_configs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (configError) throw configError;
      setConfigs(configData || []);

      // Initialize editing state for missing configs
      const existingTypes = new Set((configData || []).map(c => c.alert_type));
      const newEditingConfigs = new Map<string, Partial<AlertConfig>>();
      
      ALERT_TYPES.forEach(type => {
        if (!existingTypes.has(type.id)) {
          newEditingConfigs.set(type.id, {
            alert_type: type.id,
            threshold_value: type.defaultThreshold,
            is_enabled: false,
            notify_email: true,
            notify_slack: false,
          });
        }
      });
      setEditingConfigs(newEditingConfigs);

      // Fetch alerts
      const { data: alertData, error: alertError } = await supabase
        .from('alerts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (alertError) throw alertError;
      setAlerts(alertData || []);
    } catch (err) {
      console.error('Error fetching alerts data:', err);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (alertType: string, config: Partial<AlertConfig>) => {
    if (!currentWorkspace?.id) return;
    setSaving(true);

    try {
      const existingConfig = configs.find(c => c.alert_type === alertType);
      
      if (existingConfig) {
        const { error } = await supabase
          .from('alert_configs')
          .update({
            threshold_value: config.threshold_value,
            is_enabled: config.is_enabled,
            notify_email: config.notify_email,
            notify_slack: config.notify_slack,
            slack_webhook_url: config.slack_webhook_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('alert_configs')
          .insert({
            workspace_id: currentWorkspace.id,
            alert_type: alertType,
            threshold_value: config.threshold_value || 0,
            is_enabled: config.is_enabled || false,
            notify_email: config.notify_email || true,
            notify_slack: config.notify_slack || false,
            slack_webhook_url: config.slack_webhook_url || null,
          });

        if (error) throw error;
      }

      toast.success('Alert configuration saved');
      fetchData();
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ 
          is_resolved: true, 
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_resolved: true } : a));
      toast.success('Alert resolved');
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  const getConfigValue = (alertType: string): Partial<AlertConfig> => {
    const existing = configs.find(c => c.alert_type === alertType);
    if (existing) return existing;
    return editingConfigs.get(alertType) || { threshold_value: 0, is_enabled: false };
  };

  const updateEditingConfig = (alertType: string, updates: Partial<AlertConfig>) => {
    const current = getConfigValue(alertType);
    const newValue = { ...current, ...updates };
    
    const existing = configs.find(c => c.alert_type === alertType);
    if (existing) {
      // Update in place for existing configs
      setConfigs(configs.map(c => c.alert_type === alertType ? { ...c, ...updates } : c));
    } else {
      setEditingConfigs(new Map(editingConfigs.set(alertType, newValue)));
    }
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === 'critical') {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Critical</Badge>;
    }
    if (severity === 'warning') {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Warning</Badge>;
    }
    return <Badge variant="outline">Info</Badge>;
  };

  const getAlertIcon = (alertType: string) => {
    const type = ALERT_TYPES.find(t => t.id === alertType);
    if (!type) return <Bell className="h-4 w-4" />;
    const Icon = type.icon;
    return <Icon className={`h-4 w-4 ${type.color}`} />;
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const unresolvedCount = alerts.filter(a => !a.is_resolved).length;

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
            <p className="text-muted-foreground">
              Configure notifications and monitor important events
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unreadCount} unread
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="alerts" className="space-y-4">
            <TabsList>
              <TabsTrigger value="alerts" className="flex items-center gap-2">
                <BellRing className="h-4 w-4" />
                Alerts
                {unresolvedCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{unresolvedCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="alerts" className="space-y-4">
              {alerts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No Alerts</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                      All systems are running smoothly. Configure alert thresholds in the settings tab.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Alerts</CardTitle>
                    <CardDescription>
                      {unresolvedCount} unresolved alerts requiring attention
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3">
                        {alerts.map(alert => (
                          <div
                            key={alert.id}
                            className={`p-4 rounded-lg border ${
                              !alert.is_read ? 'bg-accent/50 border-primary/30' : 'bg-muted/30'
                            } ${alert.is_resolved ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {getAlertIcon(alert.alert_type)}
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium">{alert.title}</p>
                                    {getSeverityBadge(alert.severity)}
                                    {alert.is_resolved && (
                                      <Badge variant="outline" className="text-success border-success/30">
                                        <Check className="h-3 w-3 mr-1" />
                                        Resolved
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              {!alert.is_resolved && (
                                <div className="flex items-center gap-2">
                                  {!alert.is_read && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => markAsRead(alert.id)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => resolveAlert(alert.id)}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Resolve
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Alert Configuration</CardTitle>
                  <CardDescription>
                    Set thresholds and notification preferences for each alert type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {ALERT_TYPES.map(type => {
                      const config = getConfigValue(type.id);
                      const Icon = type.icon;

                      return (
                        <div key={type.id} className="p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg bg-background ${type.color}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium">{type.name}</p>
                                <p className="text-sm text-muted-foreground">{type.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`${type.id}-enabled`} className="text-sm">Enabled</Label>
                              <Switch
                                id={`${type.id}-enabled`}
                                checked={config.is_enabled || false}
                                onCheckedChange={(checked) => updateEditingConfig(type.id, { is_enabled: checked })}
                              />
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor={`${type.id}-threshold`}>Threshold</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  id={`${type.id}-threshold`}
                                  type="number"
                                  step={type.id === 'spam_complaint_spike' ? '0.01' : '1'}
                                  value={config.threshold_value || type.defaultThreshold}
                                  onChange={(e) => updateEditingConfig(type.id, { 
                                    threshold_value: parseFloat(e.target.value) 
                                  })}
                                  className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">{type.unit}</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Notifications</Label>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id={`${type.id}-email`}
                                    checked={config.notify_email || false}
                                    onCheckedChange={(checked) => updateEditingConfig(type.id, { notify_email: checked })}
                                  />
                                  <Label htmlFor={`${type.id}-email`} className="text-sm">Email</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id={`${type.id}-slack`}
                                    checked={config.notify_slack || false}
                                    onCheckedChange={(checked) => updateEditingConfig(type.id, { notify_slack: checked })}
                                  />
                                  <Label htmlFor={`${type.id}-slack`} className="text-sm">Slack</Label>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-end">
                              <Button
                                onClick={() => saveConfig(type.id, config)}
                                disabled={saving}
                                size="sm"
                              >
                                {saving ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Check className="h-4 w-4 mr-2" />
                                )}
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Benchmark Reference */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recommended Thresholds</CardTitle>
                  <CardDescription>Industry best practices for cold email monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-2 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        Spam Complaints
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Google requires spam complaint rate below <strong>0.3%</strong> to maintain deliverability.
                        Set your alert threshold at 0.3% or lower to catch issues early.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-2 flex items-center gap-2">
                        <Ban className="h-4 w-4 text-warning" />
                        Bounce Rate
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Keep bounce rate under <strong>5%</strong> for healthy deliverability.
                        Rates above 5% indicate list quality issues.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
