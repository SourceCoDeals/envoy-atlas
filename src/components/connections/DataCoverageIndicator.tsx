import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Mail, MessageSquare, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";

interface DataCoverage {
  smartlead: {
    campaigns: number;
    variants: number;
    dailyMetrics: number;
    messageEvents: number;
    oldestMetricDate: string | null;
    newestMetricDate: string | null;
  };
  replyio: {
    campaigns: number;
    variants: number;
    dailyMetrics: number;
    messageEvents: number;
    oldestMetricDate: string | null;
    newestMetricDate: string | null;
  };
}

interface Props {
  workspaceId: string;
}

export function DataCoverageIndicator({ workspaceId }: Props) {
  const [coverage, setCoverage] = useState<DataCoverage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoverage = async () => {
      if (!workspaceId) return;
      
      try {
        // Get campaign IDs for this workspace first to filter variants
        const [slCampList, rioCampList] = await Promise.all([
          supabase.from("smartlead_campaigns").select("id").eq("workspace_id", workspaceId),
          supabase.from("replyio_campaigns").select("id").eq("workspace_id", workspaceId),
        ]);
        
        const slCampaignIds = (slCampList.data || []).map(c => c.id);
        const rioCampaignIds = (rioCampList.data || []).map(c => c.id);

        // Fetch counts in parallel
        const [
          slCampaigns,
          slVariants,
          slMetrics,
          slMessages,
          slMetricRange,
          rioCampaigns,
          rioVariants,
          rioMetrics,
          rioMessages,
          rioMetricRange,
        ] = await Promise.all([
          supabase.from("smartlead_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          slCampaignIds.length > 0 
            ? supabase.from("smartlead_variants").select("id", { count: "exact", head: true }).in("campaign_id", slCampaignIds)
            : Promise.resolve({ count: 0 }),
          supabase.from("smartlead_daily_metrics").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          supabase.from("smartlead_message_events").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          supabase.from("smartlead_workspace_daily_metrics").select("metric_date").eq("workspace_id", workspaceId).order("metric_date", { ascending: true }).limit(1),
          supabase.from("replyio_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          rioCampaignIds.length > 0
            ? supabase.from("replyio_variants").select("id", { count: "exact", head: true }).in("campaign_id", rioCampaignIds)
            : Promise.resolve({ count: 0 }),
          supabase.from("replyio_daily_metrics").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          supabase.from("replyio_message_events").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
          supabase.from("replyio_workspace_daily_metrics").select("metric_date").eq("workspace_id", workspaceId).order("metric_date", { ascending: true }).limit(1),
        ]);

        // Get newest dates
        const [slNewest, rioNewest] = await Promise.all([
          supabase.from("smartlead_workspace_daily_metrics").select("metric_date").eq("workspace_id", workspaceId).order("metric_date", { ascending: false }).limit(1),
          supabase.from("replyio_workspace_daily_metrics").select("metric_date").eq("workspace_id", workspaceId).order("metric_date", { ascending: false }).limit(1),
        ]);

        setCoverage({
          smartlead: {
            campaigns: slCampaigns.count || 0,
            variants: slVariants.count || 0,
            dailyMetrics: slMetrics.count || 0,
            messageEvents: slMessages.count || 0,
            oldestMetricDate: slMetricRange.data?.[0]?.metric_date || null,
            newestMetricDate: slNewest.data?.[0]?.metric_date || null,
          },
          replyio: {
            campaigns: rioCampaigns.count || 0,
            variants: rioVariants.count || 0,
            dailyMetrics: rioMetrics.count || 0,
            messageEvents: rioMessages.count || 0,
            oldestMetricDate: rioMetricRange.data?.[0]?.metric_date || null,
            newestMetricDate: rioNewest.data?.[0]?.metric_date || null,
          },
        });
      } catch (e) {
        console.error("Error fetching data coverage:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchCoverage();
  }, [workspaceId]);

  if (loading || !coverage) {
    return null;
  }

  const formatDateRange = (oldest: string | null, newest: string | null) => {
    if (!oldest || !newest) return "No data";
    const oldDate = new Date(oldest).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const newDate = new Date(newest).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return oldDate === newDate ? oldDate : `${oldDate} - ${newDate}`;
  };

  const getHealthStatus = (platform: typeof coverage.smartlead) => {
    const issues: string[] = [];
    if (platform.campaigns > 0 && platform.variants === 0) issues.push("No variants");
    if (platform.campaigns > 0 && platform.messageEvents === 0) issues.push("No replies");
    if (platform.campaigns > 0 && platform.dailyMetrics === 0) issues.push("No metrics");
    return issues;
  };

  const slIssues = getHealthStatus(coverage.smartlead);
  const rioIssues = getHealthStatus(coverage.replyio);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Data Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Smartlead */}
        {coverage.smartlead.campaigns > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Smartlead</span>
              {slIssues.length > 0 ? (
                <Badge variant="outline" className="text-warning border-warning text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {slIssues.length} issue{slIssues.length > 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-success border-success text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Mail className="h-3 w-3" />
                {coverage.smartlead.campaigns} campaigns
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <FileText className="h-3 w-3" />
                {coverage.smartlead.variants} variants
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {coverage.smartlead.dailyMetrics} metrics
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {coverage.smartlead.messageEvents} replies
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Historical: {formatDateRange(coverage.smartlead.oldestMetricDate, coverage.smartlead.newestMetricDate)}
            </div>
            {slIssues.length > 0 && (
              <div className="text-xs text-warning">
                ⚠️ {slIssues.join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Reply.io */}
        {coverage.replyio.campaigns > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reply.io</span>
              {rioIssues.length > 0 ? (
                <Badge variant="outline" className="text-warning border-warning text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {rioIssues.length} issue{rioIssues.length > 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-success border-success text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Mail className="h-3 w-3" />
                {coverage.replyio.campaigns} sequences
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <FileText className="h-3 w-3" />
                {coverage.replyio.variants} variants
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {coverage.replyio.dailyMetrics} metrics
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {coverage.replyio.messageEvents} replies
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Historical: {formatDateRange(coverage.replyio.oldestMetricDate, coverage.replyio.newestMetricDate)}
            </div>
            {rioIssues.length > 0 && (
              <div className="text-xs text-warning">
                ⚠️ {rioIssues.join(", ")}
              </div>
            )}
          </div>
        )}

        {coverage.smartlead.campaigns === 0 && coverage.replyio.campaigns === 0 && (
          <div className="text-xs text-muted-foreground text-center py-2">
            No email data synced yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
