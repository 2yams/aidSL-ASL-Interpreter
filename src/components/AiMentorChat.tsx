import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, Bot } from "lucide-react";
import Markdown from "react-markdown";
import { ChatMessage, SamplingSettings } from "../types/sign";

interface AiMentorChatProps {
  onPracticeLetter?: (letter: string) => void;
  settings?: SamplingSettings;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "model",
    text: "Welcome to aidSL Mentor. I am your AI Sign Language Coach & Deaf Culture Guide powered by Gemini 3.7. Ask me how to form any ASL sign, fingerspelling techniques, grammar rules, or request a practice drill!",
    timestamp: "Just now",
  },
];

const SUGGESTED_PROMPTS = [
  "How do I sign 'Nice to meet you' in ASL?",
  "Explain ASL sentence structure (Topic-Comment) vs English",
  "Give me a 3-letter fingerspelling drill",
  "What are non-manual markers and why do facial expressions matter?",
];

export const AiMentorChat: React.FC<AiMentorChatProps> = ({ settings }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputPrompt("");
    setIsLoading(true);

    try {
      const apiMessages = newHistory.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, apiKey: settings?.geminiApiKey }),
      });

      const data = await res.json();

      const modelMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: "model",
        text: data.reply || "I am ready to help you practice sign language.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "model",
          text: "I encountered a minor connection issue. Please try asking your question again.",
          timestamp: "Just now",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8 h-[80vh] flex flex-col justify-between text-[#1A1A1A] bg-white border border-[#D1D1D1] shadow-xl">
      
      {/* Header */}
      <div className="border-b border-[#D1D1D1] pb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#E8E6E1] border border-[#D1D1D1] flex items-center justify-center text-black shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif italic text-2xl font-bold text-[#1A1A1A] flex items-center gap-3">
              <span>aidSL AI Mentor</span>
              <span className="text-[10px] font-mono font-bold text-black border border-black px-2 py-0.5 uppercase">
                Gemini 3.7
              </span>
            </h2>
            <p className="text-xs font-mono text-[#888]">
              Interactive Sign Language Coaching & Linguistics Assistant
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-mono font-bold ${
                msg.role === "user"
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-[#E8E6E1] text-black border border-[#D1D1D1]"
              }`}
            >
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[80%] p-4 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-[#F8F7F3] border border-[#E0E0E0] text-[#1A1A1A]"
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-2 text-[10px] font-mono uppercase tracking-wider text-[#888] border-b border-[#D1D1D1]/40 pb-1">
                <span>{msg.role === "user" ? "YOU" : "AIDSL MENTOR"}</span>
                <span>{msg.timestamp}</span>
              </div>

              <div className={`markdown-body font-sans text-sm leading-relaxed space-y-2 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:mb-1 [&_code]:font-mono [&_code]:text-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded ${
                msg.role === "user" 
                  ? "[&_strong]:text-white [&_code]:bg-white/20 [&_code]:text-white" 
                  : "[&_strong]:text-black [&_code]:bg-black/10 [&_code]:text-black"
              }`}>
                <Markdown>{msg.text}</Markdown>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3 text-xs font-mono text-[#555]">
            <Sparkles className="w-4 h-4 animate-spin text-black" />
            <span>Gemini Mentor is formulating sign guidance...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Prompts */}
      <div className="py-2 shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-[#888] block mb-2">
          Suggested Practice Drills
        </span>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="whitespace-nowrap shrink-0 px-3 py-1.5 bg-[#F8F7F3] border border-[#D1D1D1] hover:border-black text-xs font-mono text-[#555] hover:text-black transition-colors cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-3 pt-3 border-t border-[#D1D1D1] shrink-0"
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask mentor about ASL signs, grammar rules, drills..."
          className="flex-1 bg-[#F8F7F3] border border-[#E0E0E0] px-4 py-3 text-sm font-mono text-[#1A1A1A] focus:border-black focus:outline-none transition-colors"
        />

        <button
          type="submit"
          disabled={!inputPrompt.trim() || isLoading}
          className="px-6 py-3 bg-black text-white hover:bg-[#333] font-mono text-xs uppercase tracking-[0.2em] font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2 shrink-0"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

    </div>
  );
};
