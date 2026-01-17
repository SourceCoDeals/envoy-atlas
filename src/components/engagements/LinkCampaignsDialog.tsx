import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, Mail } from 'lucide-react';

export interface UnlinkedCampaign {
  id: string;
  name: string;
  platform: 'smartlead' | 'replyio';
  status: string | null;
  totalSent: number;
}

interface LinkCampaignsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: UnlinkedCampaign[];
  onLink: (campaignIds: { id: string; platform: 'smartlead' | 'replyio' }[]) => Promise<void>;
  engagementName: string;
}

export function LinkCampaignsDialog({
  open,
  onOpenChange,
  campaigns,
  onLink,
  engagementName,
}: LinkCampaignsDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const filteredCampaigns = useMemo(() => {
    if (!search.trim()) return campaigns;
    const searchLower = search.toLowerCase();
    return campaigns.filter((c) => c.name.toLowerCase().includes(searchLower));
  }, [campaigns, search]);

  const toggleSelection = (campaign: UnlinkedCampaign) => {
    const key = `${campaign.platform}:${campaign.id}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const toLink = Array.from(selected).map((key) => {
        const [platform, id] = key.split(':');
        return { id, platform: platform as 'smartlead' | 'replyio' };
      });
      await onLink(toLink);
      setSelected(new Set());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSearch('');
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Campaigns</DialogTitle>
          <DialogDescription>
            Select campaigns to link to <span className="font-medium">{engagementName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] -mx-6 px-6">
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No unlinked campaigns found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCampaigns.map((campaign) => {
                const key = `${campaign.platform}:${campaign.id}`;
                const isSelected = selected.has(key);

                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-card hover:bg-accent/50'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(campaign)}
                    />
                    <Badge
                      variant="outline"
                      className={
                        campaign.platform === 'smartlead'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                          : 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                      }
                    >
                      {campaign.platform === 'smartlead' ? 'SL' : 'R.io'}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.totalSent.toLocaleString()} emails sent • {campaign.status || 'Unknown'}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || selected.size === 0}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Linking...
              </>
            ) : (
              `Link ${selected.size} Campaign${selected.size !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
