import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useChannel, Channel } from '@/hooks/useChannel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  LayoutDashboard,
  Mail,
  Inbox,
  Shield,
  FileText,
  FlaskConical,
  BookOpen,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  User,
  Building2,
  Plug,
  PieChart,
  Library,
  Briefcase,
  CalendarDays,
  Sparkles,
  Phone,
  PhoneCall,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

// Email channel navigation
const emailMainNavItems: NavItem[] = [
  { title: 'Overview', href: '/', icon: LayoutDashboard },
  { title: 'Deal Hub', href: '/deal-hub', icon: Briefcase },
  { title: 'Inbox', href: '/inbox', icon: Inbox },
  { title: 'Campaigns', href: '/campaigns', icon: Mail },
  { title: 'Copy Insights', href: '/copy-insights', icon: FileText },
  { title: 'Copy Library', href: '/copy-library', icon: Library },
  { title: 'Copywriting Studio', href: '/copywriting-studio', icon: Sparkles },
  { title: 'Audience Insights', href: '/audience-insights', icon: PieChart },
  { title: 'Deliverability', href: '/deliverability', icon: Shield },
];

const emailReportsNavItems: NavItem[] = [
  { title: 'Monthly Report', href: '/monthly-report', icon: CalendarDays },
];

const emailExperimentNavItems: NavItem[] = [
  { title: 'Experiments', href: '/experiments', icon: FlaskConical },
  { title: 'Playbook', href: '/playbook', icon: BookOpen },
];

// Calling channel navigation
const callingMainNavItems: NavItem[] = [
  { title: 'Overview', href: '/calling', icon: LayoutDashboard },
  { title: 'Call Search', href: '/calling/search', icon: Phone },
  { title: 'Best/Worst Calls', href: '/calling/best-worst', icon: BarChart3 },
  { title: 'Call Sessions', href: '/calling/sessions', icon: PhoneCall },
  { title: 'Rep Insights', href: '/calling/reps', icon: PieChart },
  { title: 'Call Library', href: '/calling/library', icon: Library },
  { title: 'Pattern Analysis', href: '/calling/patterns', icon: FlaskConical },
  { title: 'Timing Insights', href: '/calling/timing', icon: CalendarDays },
];

const callingCoachingNavItems: NavItem[] = [
  { title: 'Training Queue', href: '/calling/training', icon: BookOpen },
  { title: 'Onboarding', href: '/calling/onboarding', icon: Sparkles },
];

const callingReportsNavItems: NavItem[] = [
  { title: 'Call Analytics', href: '/calling/analytics', icon: BarChart3 },
];

// Shared navigation
const settingsNavItems: NavItem[] = [
  { title: 'Alerts', href: '/alerts', icon: Bell },
  { title: 'Connections', href: '/connections', icon: Plug },
  { title: 'Settings', href: '/settings', icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const { channel, setChannel } = useChannel();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleChannelChange = (newChannel: Channel) => {
    setChannel(newChannel);
    // Navigate to the overview of the selected channel
    if (newChannel === 'calling') {
      navigate('/calling');
    } else {
      navigate('/');
    }
  };

  // Get nav items based on current channel
  const mainNavItems = channel === 'calling' ? callingMainNavItems : emailMainNavItems;
  const reportsNavItems = channel === 'calling' ? callingReportsNavItems : emailReportsNavItems;
  const experimentNavItems = channel === 'email' ? emailExperimentNavItems : callingCoachingNavItems;

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    
    return (
      <Link
        to={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {!sidebarCollapsed && <span>{item.title}</span>}
        {item.badge && !sidebarCollapsed && (
          <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-xs">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  // Channel Rail - narrow left column
  const ChannelRail = () => (
    <div className="flex flex-col items-center py-4 gap-2 border-r border-border bg-sidebar/50">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleChannelChange('email')}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              channel === 'email'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Mail className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Email</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleChannelChange('calling')}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              channel === 'calling'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Phone className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Calling</TooltipContent>
      </Tooltip>
    </div>
  );

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link to={channel === 'calling' ? '/calling' : '/'} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold">Analytics</span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto hidden lg:flex"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
        </Button>
      </div>

      {/* Workspace selector */}
      {!sidebarCollapsed && workspaces.length > 0 && (
        <div className="p-4 border-b border-border">
          <Select
            value={currentWorkspace?.id}
            onValueChange={(value) => {
              const ws = workspaces.find(w => w.id === value);
              if (ws) setCurrentWorkspace(ws);
            }}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <SelectValue placeholder="Select workspace" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-6">
          {/* Main nav */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Dashboards
              </p>
            )}
            {mainNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          <Separator />

          {/* Reports */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Reports
              </p>
            )}
            {reportsNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          {/* Testing - Only for Email channel */}
          {experimentNavItems.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                {!sidebarCollapsed && (
                  <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Testing
                  </p>
                )}
                {experimentNavItems.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Settings */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Configuration
              </p>
            )}
            {settingsNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* User menu */}
      <div className="border-t border-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn('w-full', sidebarCollapsed ? 'justify-center' : 'justify-start')}>
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
              {!sidebarCollapsed && (
                <div className="ml-3 text-left">
                  <p className="text-sm font-medium">{user?.email?.split('@')[0]}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">{user?.email}</p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Channel Rail - Desktop */}
      <div className="hidden lg:flex w-14 flex-col border-r border-border bg-sidebar">
        <ChannelRail />
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-border bg-sidebar transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-60'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex lg:hidden transition-transform duration-300',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Channel Rail */}
        <div className="w-14 flex flex-col border-r border-border bg-sidebar">
          <ChannelRail />
        </div>
        {/* Mobile Nav */}
        <div className="w-60 flex flex-col border-r border-border bg-sidebar">
          <SidebarContent />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-4 border-b border-border px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Analytics</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-6 px-4 md:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
