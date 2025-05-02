import { ShieldAlert, Users } from "lucide-react";

export default function CommandSection() {
  return (
    <section className="cyber-panel bg-card p-6 rounded-lg shadow-lg border border-primary/20">
      <div className="scanner-overlay"></div>
      <h2 className="font-orbitron text-2xl mb-6 text-primary flex items-center">
        <ShieldAlert className="h-6 w-6 mr-2" />
        ADMIN COMMANDS
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Give Points Command */}
        <div className="cyber-border p-4 bg-muted rounded-md animate-pulse-slow">
          <h3 className="font-orbitron text-xl mb-2 text-white">!givepoints</h3>
          <p className="text-muted-foreground text-sm mb-4">Adds points to specified user's account</p>
          
          <div className="p-3 bg-black/50 rounded mb-4">
            <p className="command-line font-roboto-mono text-sm text-accent">!givepoints @user &lt;amount&gt;</p>
          </div>
          
          <div className="flex items-center text-sm text-yellow-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Admin-only command
          </div>
        </div>
        
        {/* Remove Points Command */}
        <div className="cyber-border p-4 bg-muted rounded-md animate-pulse-slow">
          <h3 className="font-orbitron text-xl mb-2 text-white">!removepoints</h3>
          <p className="text-muted-foreground text-sm mb-4">Deducts points from specified user's account</p>
          
          <div className="p-3 bg-black/50 rounded mb-4">
            <p className="command-line font-roboto-mono text-sm text-accent">!removepoints @user &lt;amount&gt;</p>
          </div>
          
          <div className="flex items-center text-sm text-yellow-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Admin-only command
          </div>
        </div>
      </div>
      
      <h2 className="font-orbitron text-2xl my-6 text-primary flex items-center">
        <Users className="h-6 w-6 mr-2" />
        USER COMMANDS
      </h2>
      
      {/* Leaderboard Command */}
      <div className="cyber-border p-4 bg-muted rounded-md animate-pulse-slow">
        <h3 className="font-orbitron text-xl mb-2 text-white">!leaderboard</h3>
        <p className="text-muted-foreground text-sm mb-4">Displays the current points leaderboard with user rankings</p>
        
        <div className="p-3 bg-black/50 rounded mb-4">
          <p className="command-line font-roboto-mono text-sm text-accent">!leaderboard</p>
        </div>
        
        <div className="flex items-center text-sm text-cyan-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          All users can access
        </div>
      </div>
    </section>
  );
}
