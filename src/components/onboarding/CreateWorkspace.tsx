import { useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building2, Sparkles } from 'lucide-react';

export function CreateWorkspace() {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Workspace name must be at least 2 characters');
      return;
    }

    setIsLoading(true);
    const { error } = await createWorkspace(name.trim());
    setIsLoading(false);

    if (error) {
      if (error.message.includes('duplicate')) {
        setError('A workspace with this name already exists');
      } else {
        setError(error.message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Your Workspace</CardTitle>
          <CardDescription>
            Set up your first workspace to start tracking campaign performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                placeholder="My Company"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                This is usually your company or team name
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating workspace...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Workspace
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-accent/50 rounded-lg">
            <h4 className="text-sm font-medium mb-2">What's next?</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Connect your Smartlead account</li>
              <li>• Import historical campaign data</li>
              <li>• Start tracking performance metrics</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}