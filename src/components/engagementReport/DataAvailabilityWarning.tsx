import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';

interface DataAvailabilityWarningProps {
  type: 'fallback' | 'partial' | 'syncing';
  message?: string;
}

export function DataAvailabilityWarning({ type, message }: DataAvailabilityWarningProps) {
  if (type === 'syncing') {
    return (
      <Alert className="mb-4 border-blue-500/50 bg-blue-500/10">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-500">Data Sync In Progress</AlertTitle>
        <AlertDescription className="text-blue-500/80">
          {message || 'Data is currently being synchronized. Some metrics may be incomplete until sync completes.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (type === 'fallback') {
    return (
      <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-600">Using Estimated Data</AlertTitle>
        <AlertDescription className="text-yellow-600/80">
          {message || 'Daily metrics are not yet available. Showing cumulative campaign totals instead. Full daily breakdown will appear after sync completes.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (type === 'partial') {
    return (
      <Alert className="mb-4 border-orange-500/50 bg-orange-500/10">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <AlertTitle className="text-orange-500">Partial Data Available</AlertTitle>
        <AlertDescription className="text-orange-500/80">
          {message || 'Some data sources are still syncing. Metrics shown may be incomplete.'}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
