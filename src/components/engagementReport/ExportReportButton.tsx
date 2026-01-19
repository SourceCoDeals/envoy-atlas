import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { 
  EngagementDetails, 
  KeyMetrics, 
  EmailMetrics, 
  CallingMetrics,
  InfrastructureMetrics,
  DomainBreakdown
} from '@/hooks/useEngagementReport';

interface ExportReportButtonProps {
  data: {
    engagement: EngagementDetails | null;
    keyMetrics: KeyMetrics;
    emailMetrics: EmailMetrics;
    callingMetrics: CallingMetrics;
    infrastructureMetrics: InfrastructureMetrics;
    linkedCampaigns: Array<{ id: string; name: string; platform: string }>;
  };
}

export function ExportReportButton({ data }: ExportReportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const generateCSV = (): string => {
    const { engagement, keyMetrics, emailMetrics, callingMetrics, infrastructureMetrics, linkedCampaigns } = data;
    
    const sections: string[] = [];
    
    // Header
    sections.push('ENGAGEMENT REPORT');
    sections.push(`Engagement,${engagement?.name || 'N/A'}`);
    sections.push(`Status,${engagement?.status || 'N/A'}`);
    sections.push(`Generated,${new Date().toISOString()}`);
    sections.push('');
    
    // Executive Summary
    sections.push('EXECUTIVE SUMMARY');
    sections.push('Metric,Value');
    sections.push(`Companies Contacted,${keyMetrics.companiesContacted}`);
    sections.push(`Contacts Reached,${keyMetrics.contactsReached}`);
    sections.push(`Total Touchpoints,${keyMetrics.totalTouchpoints}`);
    sections.push(`Email Touchpoints,${keyMetrics.emailTouchpoints}`);
    sections.push(`Call Touchpoints,${keyMetrics.callTouchpoints}`);
    sections.push(`Positive Responses,${keyMetrics.positiveResponses}`);
    sections.push(`Meetings Scheduled,${keyMetrics.meetingsScheduled}`);
    sections.push(`Opportunities,${keyMetrics.opportunities}`);
    sections.push(`Response Rate,${keyMetrics.responseRate.toFixed(2)}%`);
    sections.push(`Meeting Rate,${keyMetrics.meetingRate.toFixed(2)}%`);
    sections.push('');
    
    // Email Performance
    sections.push('EMAIL PERFORMANCE');
    sections.push('Metric,Value,Rate');
    sections.push(`Sent,${emailMetrics.sent},`);
    sections.push(`Delivered,${emailMetrics.delivered},${emailMetrics.deliveryRate.toFixed(2)}%`);
    sections.push(`Opened,${emailMetrics.opened},${emailMetrics.openRate.toFixed(2)}%`);
    sections.push(`Clicked,${emailMetrics.clicked},${emailMetrics.clickRate.toFixed(2)}%`);
    sections.push(`Replied,${emailMetrics.replied},${emailMetrics.replyRate.toFixed(2)}%`);
    sections.push(`Positive Replies,${emailMetrics.positiveReplies},${emailMetrics.positiveRate.toFixed(2)}%`);
    sections.push(`Bounced,${emailMetrics.bounced},${emailMetrics.bounceRate.toFixed(2)}%`);
    sections.push(`Meetings from Email,${emailMetrics.meetings},`);
    sections.push('');
    
    // Calling Performance
    sections.push('CALLING PERFORMANCE');
    sections.push('Metric,Value,Rate');
    sections.push(`Total Calls,${callingMetrics.totalCalls},`);
    sections.push(`Connections,${callingMetrics.connections},${callingMetrics.connectRate.toFixed(2)}%`);
    sections.push(`Conversations,${callingMetrics.conversations},${callingMetrics.conversationRate.toFixed(2)}%`);
    sections.push(`DM Conversations,${callingMetrics.dmConversations},`);
    sections.push(`Meetings,${callingMetrics.meetings},${callingMetrics.meetingRate.toFixed(2)}%`);
    sections.push(`Voicemails,${callingMetrics.voicemails},${callingMetrics.voicemailRate.toFixed(2)}%`);
    sections.push(`Avg Duration (sec),${callingMetrics.avgDuration.toFixed(0)},`);
    sections.push(`Avg Call Score,${callingMetrics.avgScore.toFixed(1)},`);
    sections.push('');
    
    // Infrastructure
    sections.push('SENDING INFRASTRUCTURE');
    sections.push('Metric,Value');
    sections.push(`Total Domains,${infrastructureMetrics.totalDomains}`);
    sections.push(`Domains with Full Auth,${infrastructureMetrics.domainsWithFullAuth}`);
    sections.push(`Total Mailboxes,${infrastructureMetrics.totalMailboxes}`);
    sections.push(`Active Mailboxes,${infrastructureMetrics.activeMailboxes}`);
    sections.push(`Daily Capacity,${infrastructureMetrics.totalDailyCapacity}`);
    sections.push(`Current Daily Sending,${infrastructureMetrics.currentDailySending}`);
    sections.push(`Utilization Rate,${infrastructureMetrics.utilizationRate.toFixed(1)}%`);
    sections.push(`Warmup Count,${infrastructureMetrics.warmupCount}`);
    sections.push(`Avg Health Score,${infrastructureMetrics.avgHealthScore}%`);
    sections.push(`Avg Bounce Rate,${infrastructureMetrics.avgBounceRate.toFixed(2)}%`);
    sections.push('');
    
    // Domain Breakdown
    if (infrastructureMetrics.domainBreakdown.length > 0) {
      sections.push('DOMAIN BREAKDOWN');
      sections.push('Domain,Mailboxes,Daily Capacity,SPF,DKIM,DMARC,Bounce Rate,Health Score');
      infrastructureMetrics.domainBreakdown.forEach((d: DomainBreakdown) => {
        sections.push(
          `${d.domain},${d.mailboxCount},${d.dailyCapacity},${d.spfValid ? 'Pass' : d.spfValid === false ? 'Fail' : 'Unknown'},${d.dkimValid ? 'Pass' : d.dkimValid === false ? 'Fail' : 'Unknown'},${d.dmarcValid ? 'Pass' : d.dmarcValid === false ? 'Fail' : 'Unknown'},${d.bounceRate.toFixed(2)}%,${d.healthScore}%`
        );
      });
      sections.push('');
    }
    
    // Linked Campaigns
    if (linkedCampaigns.length > 0) {
      sections.push('LINKED CAMPAIGNS');
      sections.push('Name,Platform');
      linkedCampaigns.forEach(c => {
        sections.push(`"${c.name}",${c.platform}`);
      });
    }
    
    return sections.join('\n');
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const csv = generateCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `engagement-report-${data.engagement?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Report exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `engagement-report-${data.engagement?.name || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Report exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON}>
          <FileText className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
