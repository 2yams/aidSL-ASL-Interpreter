export interface FingerState {
  thumb: "extended" | "curled" | "across";
  index: "extended" | "curled" | "bent";
  middle: "extended" | "curled" | "bent";
  ring: "extended" | "curled" | "bent";
  pinky: "extended" | "curled" | "bent";
}

export interface LetterData {
  letter: string;
  title: string;
  description: string;
  geminiSubtext: string;
  tip: string;
  fingerState: FingerState;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

export interface SamplingSettings {
  confidenceThreshold: number; // 50 - 95
  samplingIntervalMs: number; // 50 - 500
  frameRateFps: number; // 10, 15, 30
  showSkeleton: boolean;
  mirrorCamera: boolean;
  gestureSmoothing: boolean;
  autoAdvance: boolean;
  audioFeedback: boolean;
  enableGeminiVision: boolean;
  geminiApiKey?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export interface DetectionResult {
  recognizedLetter: string;
  confidenceScore: number;
  isMatch: boolean;
  subtext: string;
  feedback: string;
  handDetected: boolean;
  landmarks?: Point3D[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  practiceLetter?: string;
}

export interface ASLPhrase {
  id: string;
  phrase: string;
  category: "Greetings" | "Essentials" | "Polite" | "Emergency" | "Questions" | "Expressions";
  translation: string;
  explanation: string;
  letters: string[];
}

export interface PracticeStats {
  totalPracticed: number;
  lettersMastered: number;
  streakDays: number;
  accuracyRate: number;
  recentHistory: { letter: string; accuracy: number; date: string }[];
}
