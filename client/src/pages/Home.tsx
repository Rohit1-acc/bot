import { useQuery } from "@tanstack/react-query";
import CommandSection from "@/components/CommandSection";
import LeaderboardPreview from "@/components/LeaderboardPreview";
import SystemStatus from "@/components/SystemStatus";
import BotConfiguration from "@/components/BotConfiguration";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  
  // Fetch bot status
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ['/api/bot/status'],
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to fetch bot status. Please try again later.",
        variant: "destructive",
      });
    },
  });
  
  // Fetch leaderboard data
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useQuery({
    queryKey: ['/api/leaderboard'],
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to fetch leaderboard data. Please try again later.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
      <header className="flex flex-col items-center justify-center mb-10">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-orbitron font-bold mb-4 text-center">
          <span className="text-primary">Cyber</span><span className="text-secondary">Points</span>
        </h1>
        <p className="text-muted-foreground text-center text-lg md:text-xl">Discord Bot Command Interface</p>
        <div className="w-full max-w-md h-1 mt-4 bg-card relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1/3 h-full bg-primary opacity-70"></div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col gap-10 md:gap-16">
        <CommandSection />
        <LeaderboardPreview users={leaderboardData?.users} isLoading={isLeaderboardLoading} />
        <SystemStatus status={statusData} isLoading={isStatusLoading} />
        <BotConfiguration />
      </div>
    </div>
  );
}
