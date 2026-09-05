// Speech synthesis helper with American English accent preference
export function speakWithAmericanAccent(textToSpeak: string, rate = 0.95) {
  if (!textToSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const performSpeak = () => {
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();

    // Prioritize standard American / US English voices (e.g. en-US, Samantha, Google US English, Alex, Jenny, Guy, etc.)
    const usVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase() === "en-us" ||
          v.lang.toLowerCase().replace("_", "-") === "en-us"
      ) ||
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith("en-us") ||
          (v.lang.toLowerCase().startsWith("en") &&
            (v.name.toLowerCase().includes("united states") ||
              v.name.toLowerCase().includes("us english") ||
              v.name.toLowerCase().includes("american") ||
              v.name.toLowerCase().includes("samantha") ||
              v.name.toLowerCase().includes("alex") ||
              v.name.toLowerCase().includes("natural")))
      ) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("en"));

    if (usVoice) {
      utterance.voice = usVoice;
      utterance.lang = usVoice.lang || "en-US";
    } else {
      utterance.lang = "en-US";
    }

    window.speechSynthesis.speak(utterance);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    performSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      performSpeak();
    };
    // Fallback if event doesn't fire
    setTimeout(performSpeak, 100);
  }
}

// Backward compatibility alias for any prior references
export const speakWithJapaneseAccent = speakWithAmericanAccent;


