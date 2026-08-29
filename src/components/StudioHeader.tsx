import React from "react";
import { Camera, Video, MessageSquare, BookOpen, Settings, Sparkles } from "lucide-react";

export type StudioTab = "practice" | "realtime" | "mentor" | "dashboard";

interface StudioHeaderProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onOpenSettings: () => void;
  onReturnHome: () => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  onReturnHome,
}) => {
  return (
    <header className="h-16 border-b border-[#D1D1D1] bg-[#F8F7F3] sticky top-0 z-40 px-6 lg:px-10 flex items-center justify-between">
      
      {/* Zone 1: Brand Title */}
      <div className="flex items-baseline gap-2 shrink-0">
        <button
          onClick={onReturnHome}
          className="flex items-baseline gap-2 group text-left cursor-pointer focus-visible:outline-none"
          title="Return to Editorial Cover Page"
        >
          <span className="text-2xl font-serif italic font-black tracking-tighter text-[#1A1A1A]">
            aid<span className="not-italic font-sans text-lg font-light text-[#888]">SL</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-[0.2em] font-semibold text-[#888] border-l border-[#D1D1D1] pl-3 group-hover:text-black transition-colors">
            The Language of Motion
          </span>
        </button>
      </div>

      {/* Zone 2: Nav Links */}
      <nav className="flex items-center gap-6 lg:gap-10 text-[11px] uppercase tracking-[0.15em] font-medium overflow-x-auto no-scrollbar py-2">
        <button
          onClick={() => onSelectTab("practice")}
          className={`whitespace-nowrap shrink-0 pb-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "practice"
              ? "border-b-2 border-black text-black font-bold"
              : "text-[#888] hover:text-black"
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Learn</span>
        </button>

        <button
          onClick={() => onSelectTab("realtime")}
          className={`whitespace-nowrap shrink-0 pb-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "realtime"
              ? "border-b-2 border-black text-black font-bold"
              : "text-[#888] hover:text-black"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Realtime Feed</span>
        </button>

        <button
          onClick={() => onSelectTab("mentor")}
          className={`whitespace-nowrap shrink-0 pb-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "mentor"
              ? "border-b-2 border-black text-black font-bold"
              : "text-[#888] hover:text-black"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>AI Mentor</span>
        </button>

        <button
          onClick={() => onSelectTab("dashboard")}
          className={`whitespace-nowrap shrink-0 pb-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "dashboard"
              ? "border-b-2 border-black text-black font-bold"
              : "text-[#888] hover:text-black"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Academy</span>
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenSettings}
          className="p-2 text-[#1A1A1A] hover:bg-black hover:text-white border border-[#D1D1D1] transition-colors cursor-pointer"
          title="ML Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

    </header>
  );
};
