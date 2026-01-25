import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, Download, Settings } from 'lucide-react';

interface QuickActionsBarProps {
  onExportReport?: () => void;
}

export function QuickActionsBar({ onExportReport }: QuickActionsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Button asChild>
        <Link to="/campaigns">
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/campaigns">
          <LayoutGrid className="h-4 w-4 mr-2" />
          View All Campaigns
        </Link>
      </Button>
      {onExportReport && (
        <Button variant="outline" onClick={onExportReport}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      )}
    </div>
  );
}

// Fixed bottom bar for mobile
export function MobileQuickActionsBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border p-3 sm:hidden">
      <div className="flex items-center justify-around gap-2">
        <Button size="sm" className="flex-1" asChild>
          <Link to="/campaigns">
            <Plus className="h-4 w-4 mr-1.5" />
            New
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link to="/campaigns">
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            Campaigns
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link to="/inbox">
            Inbox
          </Link>
        </Button>
      </div>
    </div>
  );
}
