import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BotStatus {
  connection: {
    status: 'online' | 'offline' | 'reconnecting';
    uptime: string;
  };
  database: {
    status: 'connected' | 'disconnected' | 'connecting';
    lastSync: string;
  };
  autoReconnect: {
    enabled: boolean;
    lastReconnection: string | null;
  };
}

interface SystemStatusProps {
  status?: BotStatus;
  isLoading: boolean;
}

export default function SystemStatus({ status, isLoading }: SystemStatusProps) {
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'online':
      case 'connected':
        return 'bg-accent';
      case 'reconnecting':
      case 'connecting':
        return 'bg-yellow-500';
      default:
        return 'bg-destructive';
    }
  };
  
  return (
    <section className="cyber-panel bg-card p-6 rounded-lg shadow-lg border border-primary/20 mb-8">
      <div className="scanner-overlay"></div>
      <h2 className="font-orbitron text-2xl mb-6 text-primary flex items-center">
        <Check className="h-6 w-6 mr-2" />
        SYSTEM STATUS
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Connection Status */}
        <div className="p-4 bg-muted rounded-md">
          <h3 className="font-orbitron text-lg mb-2 text-white">Connection</h3>
          {isLoading ? (
            <>
              <div className="flex items-center mb-2">
                <Skeleton className="w-3 h-3 rounded-full mr-2" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-24 mt-2" />
            </>
          ) : (
            <>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${status ? getStatusColor(status.connection.status) : 'bg-destructive'} mr-2 animate-pulse`}></div>
                <span className={`${status?.connection.status === 'online' ? 'text-accent' : status?.connection.status === 'reconnecting' ? 'text-yellow-500' : 'text-destructive'} font-medium`}>
                  {status?.connection.status === 'online' ? 'Online' : status?.connection.status === 'reconnecting' ? 'Reconnecting' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Uptime: {status?.connection.uptime || 'N/A'}</p>
            </>
          )}
        </div>
        
        {/* Database Status */}
        <div className="p-4 bg-muted rounded-md">
          <h3 className="font-orbitron text-lg mb-2 text-white">Database</h3>
          {isLoading ? (
            <>
              <div className="flex items-center mb-2">
                <Skeleton className="w-3 h-3 rounded-full mr-2" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-24 mt-2" />
            </>
          ) : (
            <>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${status ? getStatusColor(status.database.status) : 'bg-destructive'} mr-2 animate-pulse`}></div>
                <span className={`${status?.database.status === 'connected' ? 'text-primary' : status?.database.status === 'connecting' ? 'text-yellow-500' : 'text-destructive'} font-medium`}>
                  {status?.database.status === 'connected' ? 'Connected' : status?.database.status === 'connecting' ? 'Connecting' : 'Disconnected'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Last sync: {status?.database.lastSync || 'N/A'}</p>
            </>
          )}
        </div>
        
        {/* Auto-Reconnect */}
        <div className="p-4 bg-muted rounded-md">
          <h3 className="font-orbitron text-lg mb-2 text-white">Auto-Reconnect</h3>
          {isLoading ? (
            <>
              <div className="flex items-center mb-2">
                <Skeleton className="w-3 h-3 rounded-full mr-2" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-24 mt-2" />
            </>
          ) : (
            <>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${status?.autoReconnect.enabled ? 'bg-accent' : 'bg-destructive'} mr-2`}></div>
                <span className={`${status?.autoReconnect.enabled ? 'text-accent' : 'text-destructive'} font-medium`}>
                  {status?.autoReconnect.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Last reconnection: {status?.autoReconnect.lastReconnection || 'N/A'}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
