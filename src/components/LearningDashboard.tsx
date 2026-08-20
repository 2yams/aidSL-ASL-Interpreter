import React, { useState } from "react";
import { Award, CheckCircle2, Flame, BarChart2, ArrowUpRight, Camera, Search } from "lucide-react";
import { ASL_ALPHABET, ASL_PHRASES } from "../data/aslAlphabet";
import { PracticeStats } from "../types/sign";

interface LearningDashboardProps {
  stats: PracticeStats;
  onPracticeLetter: (letter: string) => void;
}

export const LearningDashboard: React.FC<LearningDashboardProps> = ({
  stats,
  onPracticeLetter,
}) => {
  const [activeTab, setActiveTab] = useState<"alphabet" | "phrases" | "resources">("alphabet");
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All");

  const lettersArray = Object.values(ASL_ALPHABET);

  const filteredLetters = lettersArray.filter((item) => {
    const matchesSearch = item.letter.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiff = difficultyFilter === "All" || item.difficulty === difficultyFilter;
    return matchesSearch && matchesDiff;
  });

  const EXTERNAL_RESOURCES = [
    {
      title: "ASL University (Lifeprint)",
      description: "Dr. Bill Vicars' comprehensive free American Sign Language curriculum and dictionary.",
      url: "https://www.lifeprint.com/",
      category: "Free Curriculum",
    },
    {
      title: "Handspeak ASL Dictionary",
      description: "Comprehensive video dictionary, sign language culture, and linguistic guides.",
      url: "https://www.handspeak.com/",
      category: "Video Dictionary",
    },
    {
      title: "Gallaudet University ASL Connect",
      description: "Official online sign language courses from the premier university for Deaf education.",
      url: "https://gallaudet.edu/asl-connect/",
      category: "Academic",
    },
    {
      title: "National Association of the Deaf (NAD)",
      description: "Civil rights advocacy, Deaf culture, accessibility standards, and education.",
      url: "https://www.nad.org/",
      category: "Advocacy & Culture",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8 text-[#1A1A1A]">
      
      {/* Navigation Tabs */}
      <div className="border-b border-[#D1D1D1] flex items-center gap-8">
        <button
          onClick={() => setActiveTab("alphabet")}
          className={`pb-3 text-xs uppercase tracking-[0.2em] font-bold transition-colors cursor-pointer border-b-2 ${
            activeTab === "alphabet"
              ? "border-black text-black"
              : "border-transparent text-[#888] hover:text-black"
          }`}
        >
          ASL Alphabet Matrix (A-Z)
        </button>

        <button
          onClick={() => setActiveTab("phrases")}
          className={`pb-3 text-xs uppercase tracking-[0.2em] font-bold transition-colors cursor-pointer border-b-2 ${
            activeTab === "phrases"
              ? "border-black text-black"
              : "border-transparent text-[#888] hover:text-black"
          }`}
        >
          Essential Phrases Dictionary
        </button>

        <button
          onClick={() => setActiveTab("resources")}
          className={`pb-3 text-xs uppercase tracking-[0.2em] font-bold transition-colors cursor-pointer border-b-2 ${
            activeTab === "resources"
              ? "border-black text-black"
              : "border-transparent text-[#888] hover:text-black"
          }`}
        >
          External Academy Portals
        </button>
      </div>

      {/* Tab 1: Alphabet Matrix */}
      {activeTab === "alphabet" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#888] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search letter or finger posture..."
                className="w-full bg-white border border-[#E0E0E0] pl-9 pr-4 py-2 text-xs font-mono text-[#1A1A1A] focus:border-black focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#888]">Difficulty:</span>
              {["All", "Beginner", "Intermediate", "Advanced"].map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficultyFilter(level)}
                  className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer ${
                    difficultyFilter === level
                      ? "bg-black text-white font-bold"
                      : "bg-white border border-[#D1D1D1] text-[#555] hover:text-black"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLetters.map((item) => (
              <div
                key={item.letter}
                className="p-6 bg-white border border-[#D1D1D1] hover:border-black transition-all flex flex-col justify-between space-y-4 shadow-sm group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-16 bg-[#F8F7F3] border-b-4 border-black flex items-center justify-center font-serif italic font-bold text-3xl text-black group-hover:scale-105 transition-transform shrink-0">
                      {item.letter}
                    </div>
                    <div>
                      <h4 className="font-serif italic text-lg font-bold text-[#1A1A1A]">{item.title}</h4>
                      <span className="text-[10px] font-mono text-[#888] uppercase tracking-wider">{item.difficulty}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#555] leading-relaxed font-sans font-light">
                  {item.description}
                </p>

                <div className="bg-[#F8F7F3] p-3 border border-[#E0E0E0] text-[11px] font-mono text-[#1A1A1A]">
                  <span className="text-black uppercase text-[9px] font-bold block mb-0.5">Gemini Insight</span>
                  {item.geminiSubtext}
                </div>

                <button
                  onClick={() => onPracticeLetter(item.letter)}
                  className="w-full py-2.5 bg-black text-white font-mono text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-[#333] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Practice '{item.letter}' Live</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Essential Phrases */}
      {activeTab === "phrases" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ASL_PHRASES.map((phrase) => (
            <div key={phrase.id} className="p-6 bg-white border border-[#D1D1D1] space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#D1D1D1] pb-3">
                <h3 className="font-serif italic text-2xl font-bold text-[#1A1A1A]">{phrase.phrase}</h3>
                <span className="text-[10px] font-mono text-black font-bold border border-black px-2 py-0.5 uppercase">
                  {phrase.category}
                </span>
              </div>

              <p className="text-xs text-[#1A1A1A] font-sans leading-relaxed">
                <strong className="font-bold">Physical Motion:</strong> {phrase.translation}
              </p>

              <p className="text-xs text-[#555] font-sans font-light">
                {phrase.explanation}
              </p>

              <div className="pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-t border-[#D1D1D1]">
                <span className="text-[10px] font-mono text-[#888] uppercase tracking-wider mr-1">Spelling:</span>
                {phrase.letters.map((char, idx) => (
                  <span key={idx} className="w-7 h-8 bg-[#F8F7F3] border-b-2 border-black text-sm font-serif italic font-bold text-black flex items-center justify-center shrink-0">
                    {char}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: External Portals */}
      {activeTab === "resources" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EXTERNAL_RESOURCES.map((res, idx) => (
            <a
              key={idx}
              href={res.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-6 bg-white border border-[#D1D1D1] hover:border-black transition-all group space-y-3 block shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-black font-bold border border-black px-2 py-0.5 uppercase">
                  {res.category}
                </span>
                <ArrowUpRight className="w-4 h-4 text-[#888] group-hover:text-black transition-colors" />
              </div>

              <h3 className="font-serif italic text-2xl font-bold text-[#1A1A1A] group-hover:underline">
                {res.title}
              </h3>

              <p className="text-xs text-[#555] font-light leading-relaxed font-sans">
                {res.description}
              </p>
            </a>
          ))}
        </div>
      )}

    </div>
  );
};
