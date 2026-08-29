import React, { useRef, useEffect, useState, useCallback } from "react";
import { Video, Copy, Volume2, Trash2, Check, Camera, RefreshCw, PlayCircle, AlertCircle, PlusCircle, Sparkles, Activity } from "lucide-react";
import { SamplingSettings, Point3D } from "../types/sign";
import { speakWithJapaneseAccent } from "../services/speechService";
import {
  initHandLandmarker,
  classifyHandGesture,
  detectSignLanguagePhrase,
  drawHandLandmarksOnCanvas,
  drawHandBoundingBoxWithLabel,
  generateSyntheticLandmarks,
} from "../services/handDetector";

interface RealtimeTranslatorProps {
  settings: SamplingSettings;
}

interface GesturePattern {
  id: string;
  name: string;
  symbol: string;
  description: string;
}

const TRACKED_PHRASES: GesturePattern[] = [
  { id: "hello", name: "Hello", symbol: "👋", description: "5 fingers spread & open" },
  { id: "i love you", name: "I Love You", symbol: "🤟", description: "Thumb, index & pinky up" },
  { id: "thank you", name: "Thank You", symbol: "🙏", description: "Flat open hand forwards" },
  { id: "yes", name: "Yes", symbol: "✊", description: "Firm fist nod" },
  { id: "no", name: "No", symbol: "✌️", description: "Index & middle snap down" },
  { id: "peace", name: "Peace", symbol: "✌️", description: "V peace sign" },
  { id: "help", name: "Help", symbol: "👍", description: "Thumbs up gesture" },
  { id: "ok", name: "OK", symbol: "👌", description: "Thumb-index ring with 3 fingers" },
];

const ALPHABET_ALL = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "V", "W", "Y"];

export const RealtimeTranslator: React.FC<RealtimeTranslatorProps> = ({ settings }) => {
  const [cameraMode, setCameraMode] = useState<"active" | "idle" | "denied" | "demo">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [translatedText, setTranslatedText] = useState("");
  const [currentPrediction, setCurrentPrediction] = useState<string>("hello");
  const [confidence, setConfidence] = useState<number>(0);
  const [isCopied, setIsCopied] = useState(false);
  const [autoAddMode, setAutoAddMode] = useState(false);
  const [holdCount, setHoldCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastSpokenTextRef = useRef<string>("");
  const lastSpokenTimestampRef = useRef<number>(0);

  // Debounced TTS function with Japanese accent preference
  const speakDebounced = useCallback((textToSpeak: string) => {
    if (!textToSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const now = Date.now();
    const cleanText = textToSpeak.trim();
    if (cleanText === lastSpokenTextRef.current && now - lastSpokenTimestampRef.current < 2500) {
      return;
    }
    speakWithJapaneseAccent(cleanText, 0.95);
    lastSpokenTextRef.current = cleanText;
    lastSpokenTimestampRef.current = now;
  }, []);

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
      console.warn("Realtime camera access failed:", err);
      setCameraError(err?.message || "Camera permission was denied or restricted by browser settings.");
      setCameraMode("denied");
    }
  };

  useEffect(() => {
    requestCameraAccess();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCommitPrediction = (item?: string) => {
    const textToAdd = item || currentPrediction;
    if (!textToAdd) return;

    setTranslatedText((prev) => {
      const isPhrase = textToAdd.length > 1;
      const needsSpace = prev.length > 0 && !prev.endsWith(" ");
      const nextText = isPhrase
        ? `${prev}${needsSpace ? " " : ""}${textToAdd}`
        : `${prev}${textToAdd}`;

      if (isPhrase) {
        speakDebounced(textToAdd);
      }
      return nextText;
    });
  };

  // Frame processing loop
  useEffect(() => {
    let landmarker: any = null;
    let isActive = true;

    async function setup() {
      landmarker = await initHandLandmarker();
    }
    setup();

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
                const res = landmarker.detectForVideo(video, performance.now());
                if (res.landmarks && res.landmarks.length > 0) {
                  detectedLandmarks = res.landmarks[0] as Point3D[];
                }
              } catch {
                // fallback
              }
            }

            if (detectedLandmarks && detectedLandmarks.length >= 21) {
              // 1. Check for automated phrase recognition first
              const phraseResult = detectSignLanguagePhrase(detectedLandmarks);

              let finalPrediction = "hello";
              let finalScore = 0;

              if (phraseResult.isPhrase && phraseResult.confidence >= 75) {
                finalPrediction = phraseResult.phrase;
                finalScore = phraseResult.confidence;
                // Automatically vocalize detected phrase aloud without spamming
                speakDebounced(phraseResult.phrase);
              } else {
                // Classify detected hand posture across letters
                const clf = classifyHandGesture(detectedLandmarks, "");
                finalPrediction = clf.predictedLetter;
                finalScore = clf.confidenceScore;
              }

              // 2. Draw Skeleton lines & joints inside hand
              if (settings.showSkeleton) {
                drawHandLandmarksOnCanvas(
                  ctx,
                  detectedLandmarks,
                  canvas.width,
                  canvas.height,
                  settings.mirrorCamera,
                  "#FFFFFF"
                );
              }

              // 3. Draw Bounding Box with Label & Confidence above top edge
              drawHandBoundingBoxWithLabel(
                ctx,
                detectedLandmarks,
                canvas.width,
                canvas.height,
                finalPrediction,
                finalScore,
                settings.mirrorCamera,
                "#EF4444"
              );

              setConfidence(finalScore);
              setCurrentPrediction(finalPrediction);

              // Auto-commit on hold
              if (finalScore >= settings.confidenceThreshold && autoAddMode) {
                setHoldCount((prev) => {
                  const next = prev + 1;
                  if (next === 28) {
                    handleCommitPrediction(finalPrediction);
                    return 0;
                  }
                  return next;
                });
              } else {
                setHoldCount(0);
              }
            } else {
              setConfidence(0);
              setHoldCount(0);
            }
          } else if (cameraMode === "demo") {
            // Simulator Mode - Automatically cycles through common phrases and letters
            canvas.width = 640;
            canvas.height = 480;
            ctx.fillStyle = "#0D0D0E";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Subtle dark grid
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
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

            const simItems = ["hello", "B", "i love you", "L", "yes", "V", "help", "thank you"];
            const simIdx = Math.floor(Date.now() / 2500) % simItems.length;
            const simTarget = simItems[simIdx];
            const simLandmarks = generateSyntheticLandmarks(simTarget.toUpperCase());
            const phraseRes = detectSignLanguagePhrase(simLandmarks);
            let simPred = simTarget;
            let simConf = 88.5;

            if (phraseRes.isPhrase) {
              simPred = phraseRes.phrase;
              simConf = phraseRes.confidence;
            } else {
              const clf = classifyHandGesture(simLandmarks, simTarget);
              simPred = clf.predictedLetter;
              simConf = clf.confidenceScore;
            }

            if (settings.showSkeleton) {
              drawHandLandmarksOnCanvas(ctx, simLandmarks, canvas.width, canvas.height, false, "#FFFFFF");
            }

            drawHandBoundingBoxWithLabel(
              ctx,
              simLandmarks,
              canvas.width,
              canvas.height,
              simPred,
              simConf,
              false,
              "#EF4444"
            );

            setConfidence(simConf);
            setCurrentPrediction(simPred);

            if (simPred.length > 1) {
              speakDebounced(simPred);
            }

            if (autoAddMode) {
              setHoldCount((prev) => {
                const next = prev + 1;
                if (next === 40) {
                  handleCommitPrediction(simTarget);
                  return 0;
                }
                return next;
              });
            }
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
  }, [cameraMode, settings, autoAddMode, currentPrediction]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(translatedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSpeakText = () => {
    speakDebounced(translatedText);
  };

  const handleAddSpace = () => {
    setTranslatedText((prev) => prev + " ");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6 text-[#1A1A1A]">
      
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D1D1D1] pb-4">
        <div>
          <h2 className="font-serif italic text-3xl font-bold text-[#1A1A1A] flex items-center gap-3">
            <Video className="w-6 h-6 text-black" />
            <span>Realtime Translation Stream</span>
          </h2>
          <p className="text-xs font-mono text-[#555] mt-1">
            Automatic sign language phrase & letter tracking with live bounding box recognition.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={requestCameraAccess}
            className={`px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-bold border transition-colors cursor-pointer flex items-center gap-2 ${
              cameraMode === "active" ? "bg-black text-white border-black" : "bg-white border-[#D1D1D1] text-black"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{cameraMode === "active" ? "Camera Live" : "Enable Camera"}</span>
          </button>

          <button
            onClick={() => setCameraMode("demo")}
            className={`px-4 py-2 border transition-colors cursor-pointer flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold ${
              cameraMode === "demo"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-[#F8F7F3] border-[#D1D1D1] text-[#1A1A1A] hover:border-black"
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>{cameraMode === "demo" ? "Simulator Active" : "Simulator"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Realtime Video Stream & Automatic Tracking */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="relative bg-[#0A0A0A] rounded-2xl border border-[#D1D1D1] aspect-16/9 overflow-hidden shadow-xl">
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

            {/* Camera Access Request Overlay */}
            {cameraMode !== "active" && cameraMode !== "demo" && (
              <div className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-20 space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-1">
                  <Camera className="w-8 h-8" />
                </div>

                <div className="max-w-md space-y-2">
                  <h3 className="font-serif italic text-2xl font-bold">Realtime Camera Feed</h3>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Allow camera access to enable automatic sign language bounding box recognition and phrase tracking.
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
                    <span>Request Camera Access</span>
                  </button>

                  <button
                    onClick={() => setCameraMode("demo")}
                    className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Launch Simulator Mode</span>
                  </button>
                </div>
              </div>
            )}

            {/* Auto-Add Hold Progress Bar */}
            {autoAddMode && holdCount > 0 && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-white/20 px-3 py-2 rounded-lg text-white flex items-center justify-between text-xs z-10">
                <span className="text-[10px] font-mono text-emerald-400">Holding sign to auto-commit:</span>
                <div className="w-36 bg-white/20 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full transition-all" style={{ width: `${(holdCount / 28) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* ADD LETTER / PHRASE Action Bar */}
          <div className="p-4 bg-white border border-[#D1D1D1] flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCommitPrediction()}
                disabled={confidence === 0}
                className="px-6 py-3 bg-black hover:bg-zinc-800 text-white font-mono text-xs uppercase tracking-[0.2em] font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-2 shadow-sm"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>
                  ADD {currentPrediction ? `"${currentPrediction.toUpperCase()}"` : "SIGN"}
                </span>
              </button>

              <button
                onClick={handleAddSpace}
                className="px-4 py-3 bg-[#F8F7F3] hover:bg-[#E8E6E1] text-black border border-[#D1D1D1] font-mono text-xs uppercase tracking-wider font-semibold cursor-pointer"
              >
                + Space
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-[#555] select-none">
              <input
                type="checkbox"
                checked={autoAddMode}
                onChange={(e) => setAutoAddMode(e.target.checked)}
                className="w-4 h-4 accent-black cursor-pointer"
              />
              <span>Auto-commit on hold</span>
            </label>
          </div>

          {/* Automatic Gesture Detection Patterns Display */}
          <div className="p-4 bg-white border border-[#D1D1D1] space-y-3">
            <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Automatic Hand Sign Recognizers</span>
              </span>
              <span className="text-[9px] font-mono text-[#888]">Live sensor auto-detects postures</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TRACKED_PHRASES.map((item) => {
                const isCurrentActive = currentPrediction.toLowerCase() === item.id.toLowerCase() && confidence > 70;
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 border transition-all rounded-sm flex flex-col justify-between space-y-1 ${
                      isCurrentActive
                        ? "bg-emerald-50 border-emerald-500 shadow-sm"
                        : "bg-[#F8F7F3] border-[#E0E0E0]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{item.symbol}</span>
                      {isCurrentActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase block text-[#1A1A1A]">
                        {item.name}
                      </span>
                      <span className="text-[9px] text-[#777] font-light truncate block">
                        {item.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Live Transcript & Speech Output Panel */}
        <div className="lg:col-span-5 bg-white border border-[#D1D1D1] p-6 lg:p-8 flex flex-col justify-between space-y-6 shadow-md">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#D1D1D1] pb-3">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1A1A1A]">
                Assembled Sentence
              </span>
              <span className="text-[10px] font-mono text-black font-bold border border-black px-2 py-0.5">
                {translatedText.length} CHARS
              </span>
            </div>

            <div className="min-h-56 bg-[#F8F7F3] border border-[#E0E0E0] p-4 font-mono text-lg text-[#1A1A1A] leading-relaxed break-words">
              {translatedText || (
                <span className="text-[#888] font-sans font-light italic">
                  Sign postures into camera or hold signs to construct spoken transcript...
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSpeakText}
                disabled={!translatedText}
                className="flex-1 py-3 bg-black hover:bg-zinc-800 text-white text-xs uppercase tracking-[0.2em] font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm"
              >
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Play Text-to-Speech</span>
              </button>

              <button
                onClick={handleCopyText}
                disabled={!translatedText}
                className="p-3 bg-[#F8F7F3] border border-[#D1D1D1] hover:bg-[#E8E6E1] text-black cursor-pointer disabled:opacity-40"
                title="Copy Text"
              >
                {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setTranslatedText("")}
                disabled={!translatedText}
                className="p-3 bg-[#F8F7F3] border border-[#D1D1D1] hover:bg-red-100 text-red-600 cursor-pointer disabled:opacity-40"
                title="Clear Text"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
