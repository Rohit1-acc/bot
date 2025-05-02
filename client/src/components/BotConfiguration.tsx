import { Settings } from "lucide-react";

export default function BotConfiguration() {
  return (
    <section className="cyber-panel bg-card p-6 rounded-lg shadow-lg border border-primary/20">
      <div className="scanner-overlay"></div>
      <h2 className="font-orbitron text-2xl mb-6 text-primary flex items-center">
        <Settings className="h-6 w-6 mr-2" />
        CONFIGURATION
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Settings */}
        <div className="p-4 bg-muted rounded-md">
          <h3 className="font-orbitron text-lg mb-4 text-white">Security</h3>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground text-sm">Discord Bot Token</span>
              <span className="text-accent text-xs">Secure</span>
            </div>
            <div className="p-2 bg-black rounded font-mono text-xs">
              <code className="text-muted-foreground">••••••••••••••••••••••••••••</code>
              <span className="text-accent ml-1 text-xs">[REPLIT SECRET]</span>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground text-sm">Database Credentials</span>
              <span className="text-accent text-xs">Secure</span>
            </div>
            <div className="p-2 bg-black rounded font-mono text-xs">
              <code className="text-muted-foreground">••••••••••••••••••••••••••••</code>
              <span className="text-accent ml-1 text-xs">[REPLIT SECRET]</span>
            </div>
          </div>
        </div>
        
        {/* Persistence Settings */}
        <div className="p-4 bg-muted rounded-md">
          <h3 className="font-orbitron text-lg mb-4 text-white">Data Persistence</h3>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground text-sm">Storage Type</span>
              <span className="bg-primary/20 text-primary px-2 py-1 rounded text-xs">Database</span>
            </div>
            <div className="p-2 bg-black rounded font-mono text-xs text-muted-foreground">
              <code className="text-muted-foreground">PostgreSQL via Drizzle ORM</code>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground text-sm">Backup Frequency</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-black/50 rounded">
                <div className="text-primary text-lg font-orbitron">15</div>
                <div className="text-xs text-muted-foreground">Minutes</div>
              </div>
              <div className="text-center p-2 bg-black/50 rounded">
                <div className="text-secondary text-lg font-orbitron">Auto</div>
                <div className="text-xs text-muted-foreground">On Change</div>
              </div>
              <div className="text-center p-2 bg-black/50 rounded">
                <div className="text-accent text-lg font-orbitron">3</div>
                <div className="text-xs text-muted-foreground">Backups</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
