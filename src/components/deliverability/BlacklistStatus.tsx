import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield,
  ShieldCheck, 
  ShieldX,
  RefreshCw,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface BlacklistCheck {
  listName: string;
  isListed: boolean;
  lastChecked: string;
}

interface BlacklistStatusProps {
  isListed: boolean;
  listedOn: BlacklistCheck[];
  totalChecked: number;
  lastChecked: string;
  onCheckNow?: () => void;
}

export function BlacklistStatus({ 
  isListed, 
  listedOn, 
  totalChecked, 
  lastChecked,
  onCheckNow 
}: BlacklistStatusProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Blacklist Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Checked {lastChecked}
            </span>
            {onCheckNow && (
              <Button variant="outline" size="sm" onClick={onCheckNow}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Check Now
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isListed ? (
          <div className="flex items-center gap-4 p-4 bg-success/10 border border-success/30 rounded-lg">
            <ShieldCheck className="h-10 w-10 text-success" />
            <div>
              <p className="font-medium text-success">Not Listed on Any Blacklists</p>
              <p className="text-sm text-muted-foreground">
                Checked against {totalChecked} monitored blacklists
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Including Spamhaus, Barracuda, SORBS, SpamCop, and others
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <ShieldX className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  Listed on {listedOn.filter(l => l.isListed).length} Blacklist(s)
                </p>
                <p className="text-sm text-muted-foreground">
                  This will significantly impact your deliverability
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {listedOn.filter(l => l.isListed).map((list) => (
                <div 
                  key={list.listName}
                  className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <ShieldX className="h-4 w-4 text-destructive" />
                    <span className="font-medium">{list.listName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Listed</Badge>
                    <Button variant="outline" size="sm">
                      Delist <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-warning/10 border border-warning/30 rounded-md">
              <p className="text-sm font-medium text-warning">Recommended Actions</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Stop sending from affected IP/domain temporarily</li>
                <li>Review and clean your email lists</li>
                <li>Submit delisting requests to each blacklist</li>
                <li>Investigate source of spam complaints</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
