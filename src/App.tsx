import React, { useState } from "react";
import { VogueLanding } from "./components/VogueLanding";
import { StudioHeader, StudioTab } from "./components/StudioHeader";
import { LiveCameraStudio } from "./components/LiveCameraStudio";
import { RealtimeTranslator } from "./components/RealtimeTranslator";
import { AiMentorChat } from "./components/AiMentorChat";
import { LearningDashboard } from "./components/LearningDashboard";
import { SamplingSettingsModal } from "./components/SamplingSettingsModal";
import { SamplingSettings, PracticeStats } from "./types/sign";

export default function App() {
  const [currentView, setCurrentView] = useState<"landing" | "studio">("landing");
  const [activeTab, setActiveTab] = useState<StudioTab>("practice");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [settings, setSettings] = useState<SamplingSettings>({
    confidenceThreshold: 83,
    samplingIntervalMs: 100,
    frameRateFps: 30,
    showSkeleton: true,
    mirrorCamera: true,
    gestureSmoothing: true,
    autoAdvance: true,
    audioFeedback: true,
    enableGeminiVision: true,
    geminiApiKey: "",
  });

  const [stats, setStats] = useState<PracticeStats>({
    totalPracticed: 45,
    lettersMastered: 14,
    streakDays: 6,
    accuracyRate: 98,
    recentHistory: [
      { letter: "B", accuracy: 98, date: "Today" },
      { letter: "A", accuracy: 96, date: "Today" },
      { letter: "L", accuracy: 94, date: "Yesterday" },
    ],
  });

  const [practiceLetter, setPracticeLetter] = useState<string | undefined>(undefined);

  const handleLetterMastered = (letter: string) => {
    setStats((prev) => ({
      ...prev,
      lettersMastered: Math.min(26, prev.lettersMastered + 1),
      totalPracticed: prev.totalPracticed + 2,
    }));
  };

  const handlePracticeSpecificLetter = (letter: string) => {
    setPracticeLetter(letter.toUpperCase());
    setCurrentView("studio");
    setActiveTab("practice");
  };

  if (currentView === "landing") {
    return <VogueLanding onEnterApp={() => setCurrentView("studio")} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F7F3] text-[#1A1A1A] font-sans flex flex-col justify-between selection:bg-black selection:text-white">
      
      {/* Top Header Navigation */}
      <StudioHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onReturnHome={() => setCurrentView("landing")}
      />

      {/* Main Tab Content Viewport */}
      <main className="flex-1 py-4">
        {activeTab === "practice" && (
          <LiveCameraStudio
            settings={settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onUpdateSettings={setSettings}
            onLetterMastered={handleLetterMastered}
            practiceLetter={practiceLetter}
          />
        )}

        {activeTab === "realtime" && (
          <RealtimeTranslator settings={settings} />
        )}

        {activeTab === "mentor" && (
          <AiMentorChat settings={settings} onPracticeLetter={handlePracticeSpecificLetter} />
        )}

        {activeTab === "dashboard" && (
          <LearningDashboard
            stats={stats}
            onPracticeLetter={handlePracticeSpecificLetter}
          />
        )}
      </main>

      {/* Sampling Settings Modal */}
      <SamplingSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />

      {/* Studio Footer */}
      <footer className="border-t border-[#D1D1D1] py-4 px-6 text-center text-xs font-mono text-[#888]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>aidSL • The Language of Motion</span>
          <span>Powered by Gemini 3.7 & MediaPipe Neural ML</span>
        </div>
      </footer>

    </div>
  );
}
