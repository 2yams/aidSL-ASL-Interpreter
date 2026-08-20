import React, { useState } from "react";
import { X, Sliders, Key, Eye, EyeOff, Sparkles } from "lucide-react";
import { SamplingSettings } from "../types/sign";

interface SamplingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SamplingSettings;
  onUpdateSettings: (newSettings: SamplingSettings) => void;
}

export const SamplingSettingsModal: React.FC<SamplingSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleChange = <K extends keyof SamplingSettings>(
    key: K,
    value: SamplingSettings[K]
  ) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#D1D1D1] max-w-lg w-full p-8 shadow-2xl space-y-6 text-[#1A1A1A] relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D1D1D1] pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-black" />
            <h3 className="font-serif italic text-xl font-bold text-[#1A1A1A]">ML & Neural Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#888] hover:text-black transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 text-xs font-mono">
          
          {/* Gemini API Key Field */}
          <div className="p-4 bg-[#F8F7F3] border border-[#E0E0E0] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[#1A1A1A] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-black" />
                <span>Gemini API Key</span>
              </label>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">
                {settings.geminiApiKey ? "Custom Key Saved" : "Sandbox Proxy Default"}
              </span>
            </div>

            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={settings.geminiApiKey || ""}
                onChange={(e) => handleChange("geminiApiKey", e.target.value)}
                placeholder="AIzaSy... (Leave empty to use Sandbox proxy)"
                className="w-full bg-white border border-[#D1D1D1] p-2.5 pr-10 text-xs text-[#1A1A1A] font-mono focus:outline-none focus:border-black"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888] hover:text-black p-1 cursor-pointer"
                title={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[10px] text-[#666] leading-relaxed pt-1">
              <Sparkles className="w-3 h-3 text-amber-600 inline mr-1" />
              In preview sandbox, requests route through the built-in Gemini server proxy (`/api/analyze-frame`). Add your personal key for standalone demo deployments.
            </p>
          </div>

          {/* Confidence Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#1A1A1A] font-bold uppercase tracking-wider">Min Confidence Threshold</span>
              <span className="text-black font-bold text-sm">{settings.confidenceThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={settings.confidenceThreshold}
              onChange={(e) => handleChange("confidenceThreshold", Number(e.target.value))}
              className="w-full accent-black cursor-pointer"
            />
            <p className="text-[10px] text-[#888]">
              Higher values require stricter finger alignment before marking a sign posture as synchronized.
            </p>
          </div>

          {/* FPS */}
          <div className="space-y-2">
            <span className="text-[#1A1A1A] font-bold uppercase tracking-wider block">Video Sampling Rate</span>
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 30].map((fps) => (
                <button
                  key={fps}
                  onClick={() => handleChange("frameRateFps", fps)}
                  className={`py-2 border transition-colors cursor-pointer text-center ${
                    settings.frameRateFps === fps
                      ? "bg-black text-white font-bold border-black"
                      : "bg-[#F8F7F3] border-[#D1D1D1] text-[#555] hover:text-black"
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-4 border-t border-[#D1D1D1]">
            
            <label className="flex items-center justify-between cursor-pointer p-3 bg-[#F8F7F3] border border-[#E0E0E0]">
              <span className="text-[#1A1A1A] font-medium">Mirror Camera View</span>
              <input
                type="checkbox"
                checked={settings.mirrorCamera}
                onChange={(e) => handleChange("mirrorCamera", e.target.checked)}
                className="accent-black w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-3 bg-[#F8F7F3] border border-[#E0E0E0]">
              <span className="text-[#1A1A1A] font-medium">Show 3D Hand Skeleton Overlay</span>
              <input
                type="checkbox"
                checked={settings.showSkeleton}
                onChange={(e) => handleChange("showSkeleton", e.target.checked)}
                className="accent-black w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-3 bg-[#F8F7F3] border border-[#E0E0E0]">
              <span className="text-[#1A1A1A] font-medium">Auto-Advance Letter on Match</span>
              <input
                type="checkbox"
                checked={settings.autoAdvance}
                onChange={(e) => handleChange("autoAdvance", e.target.checked)}
                className="accent-black w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-3 bg-[#F8F7F3] border border-[#E0E0E0]">
              <span className="text-[#1A1A1A] font-medium">Enable Gesture Smoothing Filter</span>
              <input
                type="checkbox"
                checked={settings.gestureSmoothing}
                onChange={(e) => handleChange("gestureSmoothing", e.target.checked)}
                className="accent-black w-4 h-4 cursor-pointer"
              />
            </label>

          </div>

        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#D1D1D1] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-black text-white font-mono font-bold uppercase text-xs tracking-[0.2em] hover:bg-[#333] transition-colors cursor-pointer"
          >
            Apply Settings
          </button>
        </div>

      </div>
    </div>
  );
};
