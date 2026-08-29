// Speech synthesis helper with Japanese-accented English preference
export function speakWithJapaneseAccent(textToSpeak: string, rate = 0.95) {
  if (!textToSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const performSpeak = () => {
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = rate;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();

    // Look for Japanese voice (e.g. ja-JP, ja_JP, Kyoko, Otoya, Nanami, Google 日本語, etc.)
    const jaVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith("ja") ||
        v.lang.toLowerCase().includes("jp") ||
        v.name.toLowerCase().includes("japanese") ||
        v.name.toLowerCase().includes("kyoko") ||
        v.name.toLowerCase().includes("otoya") ||
        v.name.toLowerCase().includes("nanami") ||
        v.name.toLowerCase().includes("meimei")
    );

    if (jaVoice) {
      utterance.voice = jaVoice;
      utterance.lang = jaVoice.lang || "ja-JP";
    } else {
      utterance.lang = "ja-JP";
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

