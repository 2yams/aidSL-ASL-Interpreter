import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, Volume2, Sparkles, ChevronRight, ChevronLeft, Settings, AlertCircle, PlayCircle, RefreshCw, Info, X, CheckCircle, BookOpen } from "lucide-react";
import { ASL_ALPHABET, ASL_PHRASES } from "../data/aslAlphabet";
import { SamplingSettings, DetectionResult, Point3D } from "../types/sign";
import { speakWithJapaneseAccent } from "../services/speechService";
import { initHandLandmarker, classifyHandGesture, drawHandLandmarksOnCanvas, generateSyntheticLandmarks, drawHandBoundingBoxWithLabel } from "../services/handDetector";
import confetti from "canvas-confetti";

interface LiveCameraStudioProps {
  settings: SamplingSettings;
  onOpenSettings: () => void;
  onUpdateSettings?: (newSettings: SamplingSettings) => void;
  onLetterMastered?: (letter: string) => void;
  practiceLetter?: string;
}

// Extract tokens from input (grouping known phrases even within sentences)
export interface StudioToken {
  id: string;
  type: "phrase" | "letter" | "space";
  value: string;
  display: string;
  phraseData?: (typeof ASL_PHRASES)[number];
}

export function parseSentenceTokens(text: string): StudioToken[] {
  const upper = text.toUpperCase();
  const tokens: StudioToken[] = [];
  let i = 0;
  let tokenId = 0;

  // Sorted by length descending so longer phrases like "I LOVE YOU" match before single words
  const sortedPhrases = [...ASL_PHRASES].sort((a, b) => b.phrase.length - a.phrase.length);

  while (i < upper.length) {
    const remaining = upper.slice(i);
    let matchedPhrase: (typeof ASL_PHRASES)[number] | null = null;

    for (const phraseItem of sortedPhrases) {
      const phraseText = phraseItem.phrase.toUpperCase();
      if (remaining.startsWith(phraseText)) {
        const charBefore = i > 0 ? upper[i - 1] : " ";
        const charAfter = i + phraseText.length < upper.length ? upper[i + phraseText.length] : " ";

        const isBoundaryBefore = /[^A-Z0-9]/.test(charBefore);
        const isBoundaryAfter = /[^A-Z0-9]/.test(charAfter);

        if (isBoundaryBefore && isBoundaryAfter) {
          matchedPhrase = phraseItem;
          break;
        }
      }
    }

    if (matchedPhrase) {
      tokens.push({
        id: `phrase-${tokenId++}`,
        type: "phrase",
        value: matchedPhrase.phrase,
        display: matchedPhrase.phrase,
        phraseData: matchedPhrase,
      });
      i += matchedPhrase.phrase.length;
    } else {
      const char = upper[i];
      if (char === " " || char === "\n" || char === "\t") {
        tokens.push({
          id: `space-${tokenId++}`,
          type: "space",
          value: " ",
          display: " ",
        });
        i += 1;
      } else if (/[A-Z]/.test(char)) {
        tokens.push({
          id: `letter-${tokenId++}`,
          type: "letter",
          value: char,
          display: char,
        });
        i += 1;
      } else {
        tokens.push({
          id: `sep-${tokenId++}`,
          type: "space",
          value: char,
          display: char,
        });
        i += 1;
      }
    }
  }

  return tokens;
}

export const LiveCameraStudio: React.FC<LiveCameraStudioProps> = ({
  settings,
  onOpenSettings,
  onUpdateSettings,
  onLetterMastered,
  practiceLetter,
}) => {
  const [inputText, setInputText] = useState(practiceLetter ? practiceLetter.toUpperCase() : "HELLO WORLD");
  const [activeLetterIdx, setActiveLetterIdx] = useState(0);
  const [cameraMode, setCameraMode] = useState<"active" | "idle" | "denied" | "demo">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [subtext, setSubtext] = useState("");
  const [isLoadingSubtext, setIsLoadingSubtext] = useState(false);
  const [showGuidancePopup, setShowGuidancePopup] = useState(true);

  useEffect(() => {
    if (practiceLetter) {
      setInputText(practiceLetter.toUpperCase());
      setActiveLetterIdx(0);
    }
  }, [practiceLetter]);

  const [detection, setDetection] = useState<DetectionResult>({
    recognizedLetter: "?",
    confidenceScore: 0,
    isMatch: false,
    subtext: "Position hand clearly in frame...",
    feedback: "Awaiting hand placement...",
    handDetected: false,
  });

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Parse sentence into structured tokens (phrases, letters, separators)
  const allTokens = React.useMemo(() => parseSentenceTokens(inputText), [inputText]);
  const playableTokens = React.useMemo(
    () => allTokens.filter((t) => t.type === "phrase" || t.type === "letter"),
    [allTokens]
  );

  const safeActiveIdx = playableTokens.length > 0
    ? Math.min(Math.max(0, activeLetterIdx), playableTokens.length - 1)
    : 0;

  const currentToken = playableTokens[safeActiveIdx] || {
    id: "def",
    type: "letter" as const,
    value: "H",
    display: "H",
  };

  const currentLetter = currentToken.value;
  const isCurrentTargetPhrase = currentToken.type === "phrase";
  const currentPhraseData = currentToken.phraseData;

  const letterData = currentPhraseData
    ? {
        letter: currentPhraseData.phrase,
        title: `${currentPhraseData.phrase} (${currentPhraseData.category})`,
        description: currentPhraseData.translation,
        geminiSubtext: currentPhraseData.explanation,
        tip: currentPhraseData.explanation,
        fingerState: { thumb: "extended", index: "extended", middle: "curled", ring: "curled", pinky: "extended" },
        difficulty: "Beginner" as const,
      }
    : (ASL_ALPHABET[currentLetter] || ASL_ALPHABET["H"]);

  const lettersScrollRef = useRef<HTMLDivElement | null>(null);
  const matchHoldRef = useRef<number>(0);

  // Auto scroll active token card into view whenever safeActiveIdx changes
  useEffect(() => {
    if (lettersScrollRef.current) {
      const activeEl = lettersScrollRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [safeActiveIdx, inputText]);

  // Fetch Gemini subtext
  const fetchSubtext = useCallback(async (letter: string) => {
    setIsLoadingSubtext(true);
    try {
      const res = await fetch("/api/subtext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter, wordContext: inputText, apiKey: settings.geminiApiKey }),
      });
      const data = await res.json();
      if (data.subtext) {
        setSubtext(data.subtext);
      } else {
        setSubtext(letterData.geminiSubtext);
      }
    } catch {
      setSubtext(letterData.geminiSubtext);
    } finally {
      setIsLoadingSubtext(false);
    }
  }, [inputText, letterData.geminiSubtext]);

  useEffect(() => {
    fetchSubtext(currentLetter);
  }, [currentLetter, fetchSubtext]);

  // Request Camera Stream explicitly
  const requestCameraAccess = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam access is not supported by your browser or environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraMode("active");
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      setCameraError(err?.message || "Camera permission requested was denied or blocked by iframe security policy.");
      setCameraMode("denied");
    }
  };

  // Attempt auto camera request on mount
  useEffect(() => {
    requestCameraAccess();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Main Detection Loop (Supports live webcam or simulator demo mode)
  useEffect(() => {
    let landmarker: any = null;
    let isActive = true;

    async function setupDetector() {
      landmarker = await initHandLandmarker();
    }
    setupDetector();

    const processFrame = () => {
      if (!isActive) return;

      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          if (cameraMode === "active" && videoRef.current && videoRef.current.readyState >= 2) {
            const video = videoRef.current;
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let detectedLandmarks: Point3D[] | null = null;
            if (landmarker) {
              try {
                const results = landmarker.detectForVideo(video, performance.now());
                if (results.landmarks && results.landmarks.length > 0) {
                  detectedLandmarks = results.landmarks[0] as Point3D[];
                }
              } catch {
                // fallback
              }
            }

            if (detectedLandmarks && detectedLandmarks.length >= 21) {
              const classification = classifyHandGesture(detectedLandmarks, currentLetter);
              if (settings.showSkeleton) {
                drawHandLandmarksOnCanvas(
                  ctx,
                  detectedLandmarks,
                  canvas.width,
                  canvas.height,
                  settings.mirrorCamera,
                  "#10B981"
                );
                drawHandBoundingBoxWithLabel(
                  ctx,
                  detectedLandmarks,
                  canvas.width,
                  canvas.height,
                  classification.predictedLetter,
                  classification.confidenceScore,
                  settings.mirrorCamera,
                  "#EF4444"
                );
              }
              setDetection({
                recognizedLetter: classification.predictedLetter,
                confidenceScore: classification.confidenceScore,
                isMatch: classification.isMatch,
                subtext: classification.details,
                feedback: classification.isMatch ? "Posture Synchronized" : "Adjust Finger Alignment",
                handDetected: true,
                landmarks: detectedLandmarks,
              });

              if (classification.isMatch && classification.confidenceScore >= settings.confidenceThreshold) {
                matchHoldRef.current += 1;
                if (matchHoldRef.current >= 8) {
                  matchHoldRef.current = 0;
                  if (onLetterMastered) {
                    onLetterMastered(currentLetter);
                  }
                  if (settings.autoAdvance) {
                    if (safeActiveIdx < playableTokens.length - 1) {
                      setActiveLetterIdx((prev) => Math.min(playableTokens.length - 1, prev + 1));
                    }
                  }
                }
              } else {
                matchHoldRef.current = 0;
              }
            } else {
              setDetection((prev) => ({
                ...prev,
                handDetected: false,
                confidenceScore: Math.max(0, prev.confidenceScore - 5),
                feedback: "Position hand in frame",
              }));
            }
          } else if (cameraMode === "demo") {
            // Simulator Mode
            canvas.width = 640;
            canvas.height = 480;
            ctx.fillStyle = "#0D0D0E";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw grid pattern in demo mode
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 40) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, canvas.height);
              ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += 40) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(canvas.width, y);
              ctx.stroke();
            }

            const simLandmarks = generateSyntheticLandmarks(currentLetter);
            const classification = classifyHandGesture(simLandmarks, currentLetter);
            if (settings.showSkeleton) {
              drawHandLandmarksOnCanvas(ctx, simLandmarks, canvas.width, canvas.height, false, "#10B981");
              drawHandBoundingBoxWithLabel(
                ctx,
                simLandmarks,
                canvas.width,
                canvas.height,
                classification.predictedLetter,
                classification.confidenceScore,
                false,
                "#EF4444"
              );
            }

            setDetection({
              recognizedLetter: classification.predictedLetter,
              confidenceScore: classification.confidenceScore,
              isMatch: classification.isMatch,
              subtext: classification.details,
              feedback: "Simulated Gesture Active",
              handDetected: true,
              landmarks: simLandmarks,
            });
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      isActive = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraMode, currentLetter, settings, safeActiveIdx, playableTokens.length]);

  const handleAnalyzeFrameWithGemini = async () => {
    if (!canvasRef.current) return;
    setAiAnalyzing(true);

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (cameraMode === "active" && videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#0F0F10";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const simLms = generateSyntheticLandmarks(currentLetter);
        drawHandLandmarksOnCanvas(ctx, simLms, canvas.width, canvas.height, false, "#10B981");
      }

      const base64Image = canvas.toDataURL("image/jpeg", 0.8);

      try {
        const res = await fetch("/api/analyze-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image, targetLetter: currentLetter, apiKey: settings.geminiApiKey }),
        });
        const data = await res.json();
        setDetection((prev) => ({
          ...prev,
          confidenceScore: data.matchScore || prev.confidenceScore,
          isMatch: data.isMatch,
          subtext: data.subtext || prev.subtext,
          feedback: data.feedback || "Gemini Vision verified",
          handDetected: true,
        }));

        if (data.isMatch) {
          confetti({ particleCount: 35, spread: 50, origin: { y: 0.5 } });
        }
      } catch (err) {
        console.error("AI analysis failed:", err);
      } finally {
        setAiAnalyzing(false);
      }
    }
  };

  const handleSpeakText = () => {
    speakWithJapaneseAccent(inputText, 0.95);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 text-[#1A1A1A]">
      
      {/* Editorial Left Sidebar (Input & Settings Overview) */}
      <aside className="lg:col-span-4 bg-white border border-[#D1D1D1] p-6 lg:p-8 flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          
          <div>
            <h1 className="text-4xl font-serif italic leading-tight mb-3 tracking-tighter">
              The Standard<br />Translation.
            </h1>
            <p className="text-xs leading-relaxed text-[#555] font-light">
              Real-time computer vision hand posture mapping with live Gemini guidance.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 p-3 bg-[#F8F7F3] border border-[#D1D1D1]">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Phrases & Preset Sentences</span>
                </label>
                <span className="text-[9px] text-[#777] font-mono">Gesture Presets</span>
              </div>

              {/* Standalone Whole-Gesture Phrases */}
              <div className="flex flex-wrap gap-1.5">
                {ASL_PHRASES.map((p) => {
                  const isSelected = inputText.trim().toUpperCase() === p.phrase.toUpperCase();
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setInputText(p.phrase);
                        setActiveLetterIdx(0);
                      }}
                      className={`px-2.5 py-1 text-[10px] font-mono tracking-wider border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-black text-white border-black font-bold shadow-sm"
                          : "bg-white border-[#D1D1D1] text-[#333] hover:border-black hover:text-black"
                      }`}
                    >
                      <span>{p.phrase}</span>
                      <span className={`text-[8px] px-1 py-0.2 rounded font-sans uppercase ${isSelected ? "bg-white/20 text-emerald-300" : "bg-[#EFEFEF] text-[#666]"}`}>
                        {p.category}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Example Sentences Grouping Phrases */}
              <div className="pt-2 border-t border-[#E5E5E5] space-y-1">
                <span className="text-[9px] uppercase tracking-wider font-mono text-[#777] block">
                  Example Sentences (Phrases Grouped):
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    "HELLO WORLD",
                    "PLEASE AND THANK YOU",
                    "PEACE & LOVE",
                    "I LOVE YOU ALL",
                  ].map((sentence) => (
                    <button
                      key={sentence}
                      onClick={() => {
                        setInputText(sentence);
                        setActiveLetterIdx(0);
                      }}
                      className={`px-2 py-0.5 text-[9px] font-mono border transition-colors cursor-pointer ${
                        inputText.toUpperCase() === sentence
                          ? "bg-black text-white border-black font-bold"
                          : "bg-white border-[#D1D1D1] text-[#555] hover:border-black hover:text-black"
                      }`}
                    >
                      {sentence}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[9px] text-[#777] font-light italic leading-tight pt-0.5">
                Any known phrase within your text is grouped into a whole-sign gesture unit.
              </p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold block mb-2 text-[#1A1A1A]">
                Input Custom Sentence or Word
              </label>
              <div className="space-y-2">
                <textarea
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value.toUpperCase());
                    setActiveLetterIdx(0);
                  }}
                  rows={3}
                  placeholder="Type letters or full sentence..."
                  className="w-full bg-[#F8F7F3] border border-[#E0E0E0] p-3 text-sm font-mono text-[#1A1A1A] focus:outline-none focus:border-black resize-none"
                />
                <button
                  onClick={handleSpeakText}
                  className="w-full py-2 bg-[#F8F7F3] hover:bg-[#E8E6E1] border border-[#D1D1D1] text-[10px] uppercase tracking-[0.15em] font-semibold text-[#1A1A1A] transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Audio Pronunciation</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#D1D1D1]">
            <label className="text-[10px] uppercase tracking-[0.2em] font-bold block text-[#1A1A1A]">
              Camera & Input Mode
            </label>

            <div className="space-y-2">
              <button
                onClick={requestCameraAccess}
                className={`w-full py-2.5 text-xs font-mono uppercase tracking-wider font-bold border transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  cameraMode === "active"
                    ? "bg-black text-white border-black"
                    : "bg-[#F8F7F3] border-[#D1D1D1] text-[#1A1A1A] hover:bg-black hover:text-white"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{cameraMode === "active" ? "Camera Active" : "Enable Live Webcam"}</span>
              </button>

              <button
                onClick={() => setCameraMode("demo")}
                className={`w-full py-2 text-xs font-mono uppercase tracking-wider border transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  cameraMode === "demo"
                    ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                    : "bg-[#F8F7F3] border-[#D1D1D1] text-[#555] hover:text-black"
                }`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Virtual Gesture Simulator</span>
              </button>
            </div>

            <div className="space-y-3 pt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-light text-[#555]">Min Confidence</span>
                <span className="font-mono font-bold text-[#1A1A1A]">{settings.confidenceThreshold}%</span>
              </div>
              <div className="h-[3px] w-full bg-[#E0E0E0] relative">
                <div
                  className="absolute h-full bg-black transition-all"
                  style={{ width: `${settings.confidenceThreshold}%` }}
                />
              </div>
            </div>

            <button
              onClick={onOpenSettings}
              className="w-full py-2 border border-black text-[10px] uppercase tracking-[0.2em] font-semibold hover:bg-black hover:text-white transition-colors cursor-pointer"
            >
              Configure Settings
            </button>

            {/* Auto-Advance Checkbox directly below Configure Settings button */}
            <label className="flex items-center justify-between p-2.5 bg-[#F8F7F3] border border-[#D1D1D1] cursor-pointer hover:border-black transition-colors mt-2">
              <div className="flex flex-col pr-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]">Auto-Advance</span>
                <span className="text-[9px] text-[#777]">Advance to next sign on match</span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoAdvance}
                onChange={(e) => onUpdateSettings && onUpdateSettings({ ...settings, autoAdvance: e.target.checked })}
                className="w-4 h-4 accent-black cursor-pointer shrink-0"
              />
            </label>
          </div>

        </div>

      </aside>

      {/* Editorial Main Column (Live Feed & Gesture Letter Cards) */}
      <section className="lg:col-span-8 bg-white border border-[#D1D1D1] p-6 lg:p-8 flex flex-col justify-between">
        
        {/* Top Feed Status Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[10px] uppercase tracking-[0.3em] font-black text-[#1A1A1A]">
            Live Gesture Translation Feed
          </h2>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-green-600 font-bold">
              <span className={`w-2 h-2 rounded-full bg-green-600 ${detection.handDetected ? "animate-ping" : "opacity-40"}`} />
              {cameraMode === "demo" ? "Simulator Mode" : detection.handDetected ? "Hand Detected" : "Seeking Hand..."}
            </span>
          </div>
        </div>

        {/* Video Viewport - EDITORIAL AESTHETIC EXACT MATCH */}
        <div className="relative aspect-16/9 bg-[#0A0A0A] rounded-2xl overflow-hidden group mb-6 shadow-xl border border-[#D1D1D1]">
          
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraMode === "active" ? "block" : "hidden"} ${settings.mirrorCamera ? "scale-x-[-1]" : ""}`}
          />

          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Prompt Overlay when Camera Permission is Pending or Denied */}
          {cameraMode !== "active" && cameraMode !== "demo" && (
            <div className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-20 space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-1">
                <Camera className="w-8 h-8" />
              </div>

              <div className="max-w-md space-y-2">
                <h3 className="font-serif italic text-2xl font-bold">Enable Camera Feed</h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Click below to grant camera access and start live sign language translation. If blocked by browser permissions, switch to simulator mode.
                </p>
                {cameraError && (
                  <div className="p-3 bg-red-950/80 border border-red-500/40 text-red-300 text-[11px] font-mono flex items-start gap-2 text-left mt-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={requestCameraAccess}
                  className="px-6 py-3 bg-white text-black font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-2 shadow-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Grant Camera Access</span>
                </button>

                <button
                  onClick={() => setCameraMode("demo")}
                  className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Launch Gesture Simulator</span>
                </button>
              </div>
            </div>
          )}

          {/* Center concentric target circle overlay with accuracy-based green fade */}
          {(() => {
            const acc = Math.min(100, Math.max(0, detection.confidenceScore));
            const ratio = acc / 100;
            // Interpolate from white (255,255,255) to emerald-400 (52, 211, 153)
            const r = Math.round(255 - (255 - 52) * ratio);
            const g = Math.round(255 - (255 - 211) * ratio);
            const b = Math.round(255 - (255 - 153) * ratio);
            const colorRgb = `rgb(${r}, ${g}, ${b})`;

            return (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div
                  className="w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    border: `1px solid rgba(${r}, ${g}, ${b}, ${0.2 + 0.6 * ratio})`,
                    boxShadow: ratio > 0.6 ? `0 0 ${Math.round(ratio * 30)}px rgba(16, 185, 129, ${ratio * 0.4})` : "none",
                  }}
                >
                  <div
                    className="w-32 h-32 rounded-full transition-all duration-300 flex items-center justify-center"
                    style={{
                      border: `2px solid ${colorRgb}`,
                      backgroundColor: `rgba(16, 185, 129, ${ratio * 0.15})`,
                    }}
                  >
                    <span
                      className={`font-serif italic font-bold tracking-tighter transition-colors duration-300 text-center ${
                        currentLetter.length > 3 ? "text-2xl px-2 uppercase" : currentLetter.length > 1 ? "text-4xl" : "text-7xl"
                      }`}
                      style={{
                        color: colorRgb,
                        textShadow: ratio > 0.5 ? `0 0 ${Math.round(ratio * 20)}px rgba(16, 185, 129, 0.6)` : "none",
                      }}
                    >
                      {currentLetter}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Floating Controls Overlay */}
          <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-auto z-10">
            <button
              onClick={requestCameraAccess}
              className="px-3 py-1.5 bg-black/80 hover:bg-black backdrop-blur-md text-white border border-white/20 text-[10px] font-mono uppercase tracking-wider cursor-pointer"
            >
              {cameraMode === "active" ? "Restart Camera" : "Start Camera"}
            </button>

            <button
              onClick={() => setShowGuidancePopup((prev) => !prev)}
              className={`px-3 py-1.5 backdrop-blur-md border text-[10px] font-mono uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors ${
                showGuidancePopup
                  ? "bg-emerald-500 text-black border-emerald-400 font-bold"
                  : "bg-black/80 text-white border-white/20 hover:bg-black"
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>{showGuidancePopup ? "Guidance Active" : "Popup Guidance"}</span>
            </button>
          </div>

          {/* Bottom Compact Popup Guidance Text Box */}
          {showGuidancePopup && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-sm sm:max-w-md w-[88%] bg-black/85 backdrop-blur-md border border-white/20 text-white rounded-lg px-3.5 py-2 shadow-xl z-20 pointer-events-auto text-center animate-fadeIn">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded border ${
                  isCurrentTargetPhrase ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-white/10 text-zinc-300 border-white/20"
                }`}>
                  {isCurrentTargetPhrase ? "Phrase Guidance" : "Letter Guidance"}
                </span>
                <span className="text-xs font-bold text-white font-mono">{letterData.title}</span>
              </div>
              <p className="text-[11px] text-zinc-200 font-light leading-snug">
                {letterData.description}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Section: Grouped Sentence Tokens Strip & Specialized Guidance */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A]">
                Active Target:{" "}
                <span
                  className={`font-mono px-2 py-0.5 border rounded font-bold ${
                    isCurrentTargetPhrase
                      ? "text-emerald-800 bg-emerald-50 border-emerald-300"
                      : "text-black bg-zinc-100 border-zinc-300"
                  }`}
                >
                  {currentLetter}
                </span>
                <span className="ml-1 text-[9px] text-[#777] font-mono">
                  ({safeActiveIdx + 1} of {playableTokens.length})
                </span>
              </span>
              <span
                className={`text-[9px] px-2 py-0.5 font-mono uppercase tracking-wider rounded border ${
                  isCurrentTargetPhrase
                    ? "bg-black text-white border-black font-bold"
                    : "bg-zinc-100 text-zinc-700 border-zinc-200"
                }`}
              >
                {isCurrentTargetPhrase ? "Phrase Detection Active" : "Alphabet Detection Mode"}
              </span>
            </div>

            {isCurrentTargetPhrase && (
              <span className="text-[9px] text-emerald-700 font-mono hidden sm:inline-block">
                ★ Grouped ASL Phrase
              </span>
            )}
          </div>

          {/* Token Carousel: Phrases are grouped into single whole-sign cards, letters into individual cards */}
          <div className="flex items-center justify-between gap-3">
            <div
              ref={lettersScrollRef}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 scroll-smooth flex-1"
            >
              {allTokens.map((token) => {
                if (token.type === "space") {
                  return (
                    <div
                      key={token.id}
                      className="flex-shrink-0 w-3 h-16 flex items-center justify-center text-zinc-300 font-mono text-xs select-none"
                    >
                      •
                    </div>
                  );
                }

                const tokenPlayableIdx = playableTokens.findIndex((t) => t.id === token.id);
                const isActive = tokenPlayableIdx === safeActiveIdx;

                if (token.type === "phrase") {
                  return (
                    <button
                      key={token.id}
                      data-active={isActive}
                      onClick={() => setActiveLetterIdx(tokenPlayableIdx)}
                      className={`flex-shrink-0 px-4 py-2 h-16 flex flex-col justify-center border text-left transition-all cursor-pointer rounded-sm ${
                        isActive
                          ? "bg-black text-white border-b-4 border-black shadow-lg scale-105 font-bold"
                          : "bg-[#F8F7F3] text-[#1A1A1A] border-b-4 border-[#D1D1D1] hover:border-black"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif italic font-bold text-base whitespace-nowrap">
                          {token.value}
                        </span>
                        <span
                          className={`text-[8px] uppercase tracking-wider px-1.5 py-0.2 rounded font-mono ${
                            isActive
                              ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                              : "bg-[#E5E5E5] text-[#555]"
                          }`}
                        >
                          Phrase
                        </span>
                      </div>
                      <p
                        className={`text-[9px] truncate max-w-[140px] font-sans ${
                          isActive ? "text-zinc-300" : "text-[#777]"
                        }`}
                      >
                        {token.phraseData?.category || "Gesture"}
                      </p>
                    </button>
                  );
                }

                // Individual letter
                return (
                  <button
                    key={token.id}
                    data-active={isActive}
                    onClick={() => setActiveLetterIdx(tokenPlayableIdx)}
                    className={`flex-shrink-0 w-14 h-16 flex items-center justify-center text-2xl font-serif italic transition-all cursor-pointer rounded-sm ${
                      isActive
                        ? "bg-black text-white border-b-4 border-black shadow-lg scale-105 font-black"
                        : "bg-[#F8F7F3] text-[#1A1A1A] border-b-4 border-[#D1D1D1] hover:border-black"
                    }`}
                  >
                    {token.value}
                  </button>
                );
              })}
            </div>

            {/* Navigation arrows */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => setActiveLetterIdx((prev) => Math.max(0, prev - 1))}
                disabled={safeActiveIdx <= 0}
                className="p-2 border border-[#D1D1D1] hover:bg-black hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black cursor-pointer transition-colors"
                title="Previous sign"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveLetterIdx((prev) => Math.min(playableTokens.length - 1, prev + 1))}
                disabled={safeActiveIdx >= playableTokens.length - 1}
                className="p-2 border border-[#D1D1D1] hover:bg-black hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-black cursor-pointer transition-colors"
                title="Next sign"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Target Guidance Box (Specialized Phrase Guidance vs Letter Guidance) */}
          {isCurrentTargetPhrase ? (
            <div className="p-3.5 bg-[#F8F7F3] border border-[#D1D1D1] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Phrase Guidance — {letterData.title}</span>
                </span>
                <span className="text-[9px] font-mono text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Whole-Gesture Target
                </span>
              </div>
              <p className="text-xs text-[#222] leading-relaxed">
                <strong className="font-semibold text-black">Movement & Form: </strong>
                {letterData.description}
              </p>
              <p className="text-[11px] text-[#555] leading-relaxed italic border-t border-[#E5E5E5] pt-1.5">
                <strong className="font-medium text-[#333] not-italic">Posture Tip: </strong>
                {letterData.tip}
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-[#F8F7F3] border border-[#D1D1D1] space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-black uppercase tracking-wider text-[10px]">
                  Letter Guidance — {letterData.title}
                </span>
                <span className="text-[9px] font-mono text-[#777] bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded">
                  {letterData.difficulty}
                </span>
              </div>
              <p className="text-xs text-[#222] leading-relaxed">
                <strong className="font-semibold text-black">Forming Handshape: </strong>
                {letterData.description}
              </p>
              <p className="text-[11px] text-[#555] leading-relaxed italic border-t border-[#E5E5E5] pt-1.5">
                <strong className="font-medium text-[#333] not-italic">Posture Tip: </strong>
                {letterData.tip}
              </p>
            </div>
          )}
        </div>

      </section>

    </div>
  );
};
