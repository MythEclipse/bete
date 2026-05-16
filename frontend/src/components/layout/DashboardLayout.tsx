import type { ReactNode } from "react";
import type { DashboardTab } from "../../types/ui";
import type { VoiceStatus } from "../../types/voice";
import type { WebSocketStatus } from "../../hooks/useDashboardSocket";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  activeTab: DashboardTab;
  wsStatus: WebSocketStatus;
  voiceStatus: VoiceStatus;
  onTabChange: (tab: DashboardTab) => void;
  children: ReactNode;
}

export function DashboardLayout({ activeTab, wsStatus, voiceStatus, onTabChange, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
        <main className="flex min-w-0 flex-1 flex-col">
          <Header activeTab={activeTab} wsStatus={wsStatus} voiceStatus={voiceStatus} />
          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
