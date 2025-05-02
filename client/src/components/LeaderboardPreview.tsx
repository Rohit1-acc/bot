import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardUser {
  id: number;
  username: string;
  points: number;
  rank: number;
  avatarUrl: string;
  progressPercentage: number;
}

interface LeaderboardPreviewProps {
  users?: LeaderboardUser[];
  isLoading: boolean;
}

export default function LeaderboardPreview({ users, isLoading }: LeaderboardPreviewProps) {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-secondary";
      case 2:
        return "bg-primary";
      case 3:
        return "bg-accent";
      default:
        return "bg-card border border-muted-foreground";
    }
  };

  const formatDate = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `Today at ${hours}:${minutes} ${ampm}`;
  };

  return (
    <section className="cyber-panel bg-card p-6 rounded-lg shadow-lg border border-primary/20 mb-8">
      <div className="scanner-overlay"></div>
      <h2 className="font-orbitron text-2xl mb-6 text-primary flex items-center">
        <BarChart3 className="h-6 w-6 mr-2" />
        LEADERBOARD PREVIEW
      </h2>
      
      {/* Discord Embed Preview */}
      <div className="border-l-4 border-primary animate-glow bg-muted p-4 rounded-r-md">
        {/* Embed Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-orbitron text-xl md:text-2xl text-white">CyberPoints Leaderboard</h3>
          <span className="text-xs text-muted-foreground">Automated Response</span>
        </div>
        
        {/* Embed Image */}
        <div className="mb-6 rounded overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
            alt="Cyberpunk theme with neon lights" 
            className="w-full h-48 object-cover"
          />
        </div>
        
        {/* User Rankings */}
        <div className="mb-6">
          {isLoading ? (
            Array(5).fill(0).map((_, index) => (
              <div key={index} className="flex items-center mb-6">
                <Skeleton className="w-10 h-10 rounded-full mr-3" />
                <Skeleton className="h-12 w-12 mr-4" />
                <div className="flex-grow">
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))
          ) : !users || users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No leaderboard data available</p>
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="flex items-center mb-6 last:mb-0">
                {/* Rank */}
                <div className={`w-10 h-10 flex-shrink-0 ${getRankColor(user.rank)} rounded-full flex items-center justify-center font-orbitron font-bold text-lg mr-3`}>
                  {user.rank}
                </div>
                
                {/* Avatar */}
                <div className="h-12 w-12 mr-4 flex-shrink-0 border border-primary shadow-lg">
                  <img 
                    src={user.avatarUrl} 
                    alt={`${user.username}'s avatar`} 
                    className="h-full w-full object-cover hexagon-avatar"
                  />
                </div>
                
                {/* User Info */}
                <div className="flex-grow">
                  <div className="flex justify-between">
                    <div className="font-orbitron font-medium">{user.username}</div>
                    <div className="text-primary font-roboto-mono font-bold">{user.points.toLocaleString()} pts</div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-black/50 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="progress-bar-cyber h-full"
                      style={{ width: `${user.progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Embed Footer */}
        <div className="border-t border-muted pt-4 text-sm flex justify-between">
          <div className="text-muted-foreground">Updated: <span className="text-white">{formatDate()}</span></div>
          <div className="text-secondary">Powered by CyberPoints v1.0</div>
        </div>
      </div>
    </section>
  );
}
