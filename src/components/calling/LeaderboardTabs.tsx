import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Calendar, Clock, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type LeaderboardTab = 'top_scored' | 'meetings' | 'longest' | 'hot_leads';

interface LeaderboardTabsProps {
  activeTab: LeaderboardTab;
  onTabChange: (tab: LeaderboardTab) => void;
  counts: {
    topScored: number;
    meetings: number;
    longest: number;
    hotLeads: number;
  };
}

const TABS = [
  { id: 'top_scored', label: 'Top Scored', icon: Trophy, countKey: 'topScored' },
  { id: 'meetings', label: 'Meetings Set', icon: Calendar, countKey: 'meetings' },
  { id: 'longest', label: 'Longest Calls', icon: Clock, countKey: 'longest' },
  { id: 'hot_leads', label: 'Hot Leads', icon: Flame, countKey: 'hotLeads' },
] as const;

export function LeaderboardTabs({ activeTab, onTabChange, counts }: LeaderboardTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as LeaderboardTab)}>
      <TabsList className="h-auto p-1 bg-muted/50">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const count = counts[tab.countKey as keyof typeof counts];
          
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-background"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {count > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
