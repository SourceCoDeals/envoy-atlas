import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CampaignRow } from './CampaignRow';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';

interface CampaignTableProps {
  campaigns: CampaignWithMetrics[];
}

export function CampaignTable({ campaigns }: CampaignTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Sent</TableHead>
            <TableHead className="text-right">Open Rate</TableHead>
            <TableHead className="text-right">Click Rate</TableHead>
            <TableHead className="text-right">Reply Rate</TableHead>
            <TableHead className="text-right">Bounce Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
