import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, X, Search } from 'lucide-react';
import { CallInsightsData } from '@/hooks/useExternalCallIntel';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  data: CallInsightsData;
}

interface ObjectionItem {
  objection: string;
  callTitle: string;
  date: string;
  rep: string;
  resolved: boolean;
}

export function ObjectionsList({ data }: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all objections from records
  const allObjections: ObjectionItem[] = [];
  
  data.intelRecords.forEach(record => {
    const objections = record.objections_list || [];
    const totalObjections = record.number_of_objections || 0;
    const resolvedCount = record.objections_resolved_count || 0;
    const resolutionRate = totalObjections > 0 ? resolvedCount / totalObjections : 0;
    
    const callTitle = record.call?.to_name || 'Unknown Contact';
    const date = record.call?.started_at 
      ? format(new Date(record.call.started_at), 'MMM d, yyyy')
      : '-';
    const rep = record.call?.caller_name || 'Unknown';

    objections.forEach((objection, index) => {
      // Estimate if this specific objection was resolved
      const resolved = index < resolvedCount;
      allObjections.push({
        objection,
        callTitle,
        date,
        rep,
        resolved,
      });
    });
  });

  // Filter objections
  const filteredObjections = allObjections.filter(item =>
    item.objection.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.callTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.rep.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Objections</CardTitle>
        <CardDescription>
          Searchable list of objections extracted from calls
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search objections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 max-w-sm"
            />
          </div>
        </div>
        
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {filteredObjections.length > 0 ? (
              filteredObjections.slice(0, 50).map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                    item.resolved 
                      ? "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400" 
                      : "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
                  )}>
                    {item.resolved ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.objection}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="truncate max-w-[150px]">{item.callTitle}</span>
                      <span>•</span>
                      <span>{item.date}</span>
                      <span>•</span>
                      <span className="truncate max-w-[100px]">{item.rep}</span>
                    </div>
                  </div>
                  <Badge variant={item.resolved ? 'default' : 'destructive'} className="shrink-0">
                    {item.resolved ? 'Resolved' : 'Unresolved'}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No objections match your search' : 'No objections recorded yet'}
              </div>
            )}
          </div>
        </ScrollArea>
        
        {filteredObjections.length > 50 && (
          <div className="text-center text-sm text-muted-foreground mt-4">
            Showing first 50 of {filteredObjections.length} objections
          </div>
        )}
      </CardContent>
    </Card>
  );
}
