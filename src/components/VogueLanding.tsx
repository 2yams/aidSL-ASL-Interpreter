import React, { useRef, useEffect, useState } from "react";
import { Sparkles, Camera, BookOpen, MessageSquare, ArrowRight, ShieldCheck, Cpu, RefreshCw, Video } from "lucide-react";
import heroStockPhoto from "../assets/images/hero_sign_language_posture_1787227771639.jpg";
import { initHandLandmarker, drawHandLandmarksOnCanvas } from "../services/handDetector";
import { Point3D } from "../types/sign";

interface VogueLandingProps {
  onEnterApp: () => void;
}

export const VogueLanding: React.FC<VogueLandingProps> = ({ onEnterApp }) => {
  const [heroCamActive, setHeroCamActive] = useState(false);
  const [heroCamError, setHeroCamError] = useState<string | null>(null);
  const [handDetected, setHandDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startHeroCamera = async () => {
    setHeroCamError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setHeroCamActive(true);
    } catch (err: any) {
      console.warn("Hero camera access failed:", err);
      setHeroCamError(err?.message || "Camera access requested was denied.");
      setHeroCamActive(false);
    }
  };

  const stopHeroCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setHeroCamActive(false);
    setHandDetected(false);
  };

  useEffect(() => {
    let landmarker: any = null;
    let isActive = true;

    if (heroCamActive) {
      async function init() {
        landmarker = await initHandLandmarker();
      }
      init();

      const processFrame = () => {
        if (!isActive) return;

        if (canvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");

          if (ctx) {
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
                // Ignore detection frame glitches
              }
            }

            if (detectedLandmarks && detectedLandmarks.length >= 21) {
              drawHandLandmarksOnCanvas(ctx, detectedLandmarks, canvas.width, canvas.height, true, "#10B981");
              setHandDetected(true);
            } else {
              setHandDetected(false);
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(processFrame);
      };

      animFrameRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      isActive = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [heroCamActive]);

  useEffect(() => {
    startHeroCamera();
    return () => {
      stopHeroCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F7F3] text-[#1A1A1A] font-sans flex flex-col justify-between relative overflow-hidden">
      
      {/* Top Bar Editorial Header */}
      <header className="h-16 border-b border-[#D1D1D1] px-6 lg:px-10 flex items-center justify-between sticky top-0 bg-[#F8F7F3]/90 backdrop-blur-md z-50">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-serif italic font-black tracking-tighter text-[#1A1A1A]">
            aid<span className="not-italic font-sans text-lg font-light text-[#888]">SL</span>
          </span>
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-[0.2em] font-semibold text-[#888] border-l border-[#D1D1D1] pl-3">
            The Language of Motion
          </span>
        </div>

        <nav className="hidden md:flex gap-10 text-[11px] uppercase tracking-[0.15em] font-medium text-[#888]">
          <span className="hover:text-black cursor-pointer transition-colors" onClick={onEnterApp}>01. Live Studio</span>
          <span className="hover:text-black cursor-pointer transition-colors" onClick={onEnterApp}>02. Realtime Feed</span>
          <span className="hover:text-black cursor-pointer transition-colors" onClick={onEnterApp}>03. AI Mentor</span>
          <span className="hover:text-black cursor-pointer transition-colors" onClick={onEnterApp}>04. Academy</span>
        </nav>

        <button
          onClick={onEnterApp}
          className="bg-black text-white px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] font-semibold hover:bg-[#333] transition-colors cursor-pointer flex items-center gap-2"
        >
          <span>Launch Studio</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Editorial Hero */}
      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-12 md:py-20 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Headline Column */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E8E6E1] border border-[#D1D1D1] text-[#1A1A1A] text-[10px] font-mono tracking-widest uppercase">
              <Cpu className="w-3.5 h-3.5 text-black" />
              <span>Real-Time Neural Gesture Interpretation</span>
            </div>

            <h1 className="text-6xl md:text-8xl font-serif italic leading-[0.95] tracking-tighter text-[#1A1A1A]">
              The New<br />
              <span className="font-sans not-italic font-light text-[#555]">Standard.</span>
            </h1>

            <p className="text-[#555] text-base md:text-lg max-w-xl font-light leading-relaxed">
              Bridging the gap between silent expression and digital clarity with real-time neural interpretation, powered by Gemini 3.7 vision intelligence and MediaPipe hand tracking.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <button
                onClick={onEnterApp}
                className="bg-black text-white px-8 py-4 text-xs uppercase tracking-[0.2em] font-bold hover:bg-[#333] transition-colors cursor-pointer flex items-center justify-center gap-3 shadow-lg"
              >
                <span>Enter Live Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 px-4 py-3 bg-white border border-[#D1D1D1] text-[#555] text-xs font-mono">
                <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
                <span>Zero Latency ML • Privacy First Local Camera</span>
              </div>
            </div>
          </div>

          {/* Right Editorial Showcase Box */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-[#D1D1D1] p-8 shadow-xl space-y-6">
              
              <div className="flex items-center justify-between border-b border-[#D1D1D1] pb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${heroCamActive ? "bg-green-600 animate-pulse" : "bg-amber-500"}`} />
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#1A1A1A] font-bold">
                    Posture Sync
                  </span>
                </div>
                <span className="text-xs font-mono text-black font-bold border border-black px-2 py-0.5">
                  {heroCamActive ? (handDetected ? "Hand Tracking Active" : "Seeking Hand...") : "Interactive Demo"}
                </span>
              </div>

              {/* Viewport Box with Live Webcam Feed */}
              <div className="relative aspect-4/3 bg-[#0A0A0A] rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 group shadow-inner">
                
                {/* Real Live Camera Video Feed */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
                    heroCamActive ? "block" : "hidden"
                  }`}
                />

                {/* Hand Tracking Skeleton Canvas */}
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full z-10 ${
                    heroCamActive ? "block" : "hidden"
                  }`}
                />

                {!heroCamActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white z-10 bg-black/80">
                    <Video className="w-8 h-8 text-emerald-400 mb-2" />
                    <p className="text-xs text-zinc-300">Webcam loading...</p>
                    <button
                      onClick={startHeroCamera}
                      className="mt-3 px-4 py-1.5 bg-white text-black text-xs font-mono font-bold"
                    >
                      Enable Camera
                    </button>
                  </div>
                )}

                {/* Target Circle Overlay */}
                <div className="relative z-20 pointer-events-none flex items-center justify-center">
                  <div className="w-36 h-36 border border-white/40 rounded-full flex items-center justify-center bg-black/30 backdrop-blur-xs">
                    <div className="w-24 h-24 border border-emerald-400/80 rounded-full animate-pulse flex items-center justify-center">
                      <span className="font-serif italic text-5xl text-white font-bold drop-shadow-md">B</span>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md p-2.5 border border-white/10 rounded-lg text-white z-20">
                  <p className="text-[10px] font-light text-zinc-300 leading-tight">
                    {heroCamActive
                      ? "Real-time 3D hand tracking active. Move your hand to test posture."
                      : "Camera feed inactive."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono text-[#555]">
                <div className="p-3 bg-[#F8F7F3] border border-[#E0E0E0]">
                  <span className="text-[#888] text-[9px] uppercase block mb-1">ML Engine</span>
                  MediaPipe Vision 3D
                </div>
                <div className="p-3 bg-[#F8F7F3] border border-[#E0E0E0]">
                  <span className="text-[#888] text-[9px] uppercase block mb-1">AI Guidance</span>
                  Gemini Flash 3.7
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Features Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 pt-12 border-t border-[#D1D1D1]">
          
          <div className="p-6 bg-white border border-[#D1D1D1] space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E6E1] flex items-center justify-center text-black">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-serif italic text-xl text-[#1A1A1A]">Realtime Neural Tracking</h3>
            <p className="text-xs text-[#555] font-light leading-relaxed">
              Sub-second 3D landmark hand gesture recognition evaluated right inside your browser session.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#D1D1D1] space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E6E1] flex items-center justify-center text-black">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h3 className="font-serif italic text-xl text-[#1A1A1A]">AI Sign Mentor</h3>
            <p className="text-xs text-[#555] font-light leading-relaxed">
              Continuous natural conversation on ASL grammar rules, non-manual markers, and fingerspelling.
            </p>
          </div>

          <div className="p-6 bg-white border border-[#D1D1D1] space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#E8E6E1] flex items-center justify-center text-black">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-serif italic text-xl text-[#1A1A1A]">Structured Academy</h3>
            <p className="text-xs text-[#555] font-light leading-relaxed">
              Full A-Z sign language alphabet matrix, phrase dictionary, and curated educational resources.
            </p>
          </div>

        </div>
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#D1D1D1] px-6 py-6 text-center text-xs font-mono text-[#888]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>aidSL • The Language of Motion</span>
          <span>Version 0.1.1</span>
        </div>
      </footer>

    </div>
  );
};

