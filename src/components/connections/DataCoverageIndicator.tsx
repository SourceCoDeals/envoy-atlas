import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Mail, MessageSquare, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";

interface DataCoverage {
  campaigns: number;
  variants: number;
  dailyMetrics: number;
  responses: number;
  oldestMetricDate: string | null;
  newestMetricDate: string | null;
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
        // Get engagement IDs for this client/workspace
        const { data: engagements } = await supabase
          .from('engagements')
          .select('id')
          .eq('client_id', workspaceId);

        const engagementIds = (engagements || []).map(e => e.id);

        if (engagementIds.length === 0) {
          setCoverage({
            campaigns: 0,
            variants: 0,
            dailyMetrics: 0,
            responses: 0,
            oldestMetricDate: null,
            newestMetricDate: null,
          });
          setLoading(false);
          return;
        }

        // Fetch counts in parallel using the new unified schema
        const [
          campaignsResult,
          variantsResult,
          metricsResult,
          responsesResult,
          oldestMetricResult,
          newestMetricResult,
        ] = await Promise.all([
          supabase.from("campaigns").select("id", { count: "exact", head: true }).in("engagement_id", engagementIds),
          supabase.from("campaign_variants").select("id", { count: "exact", head: true }),
          supabase.from("daily_metrics").select("id", { count: "exact", head: true }).in("engagement_id", engagementIds),
          supabase.from("responses").select("id", { count: "exact", head: true }).in("engagement_id", engagementIds),
          supabase.from("daily_metrics").select("date").in("engagement_id", engagementIds).order("date", { ascending: true }).limit(1),
          supabase.from("daily_metrics").select("date").in("engagement_id", engagementIds).order("date", { ascending: false }).limit(1),
        ]);

        setCoverage({
          campaigns: campaignsResult.count || 0,
          variants: variantsResult.count || 0,
          dailyMetrics: metricsResult.count || 0,
          responses: responsesResult.count || 0,
          oldestMetricDate: oldestMetricResult.data?.[0]?.date || null,
          newestMetricDate: newestMetricResult.data?.[0]?.date || null,
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

  const getHealthIssues = () => {
    const issues: string[] = [];
    if (coverage.campaigns > 0 && coverage.variants === 0) issues.push("No variants");
    if (coverage.campaigns > 0 && coverage.responses === 0) issues.push("No replies");
    if (coverage.campaigns > 0 && coverage.dailyMetrics === 0) issues.push("No metrics");
    return issues;
  };

  const issues = getHealthIssues();

  if (coverage.campaigns === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Data Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground text-center py-2">
            No campaign data synced yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Data Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Unified Data</span>
            {issues.length > 0 ? (
              <Badge variant="outline" className="text-warning border-warning text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {issues.length} issue{issues.length > 1 ? "s" : ""}
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
              {coverage.campaigns} campaigns
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <FileText className="h-3 w-3" />
              {coverage.variants} variants
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {coverage.dailyMetrics} metric days
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {coverage.responses} responses
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Historical: {formatDateRange(coverage.oldestMetricDate, coverage.newestMetricDate)}
          </div>
          {issues.length > 0 && (
            <div className="text-xs text-warning">
              ⚠️ {issues.join(", ")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
