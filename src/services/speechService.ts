// Speech synthesis helper with Japanese-accented English preference
export function speakWithJapaneseAccent(textToSpeak: string, rate = 0.95) {
  if (!textToSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();

  // 1. Look for Japanese voice (e.g. ja-JP, Kyoko, Otoya, Nanami, Google 日本語)
  // When an English string is spoken with a ja-JP voice, the browser's engine applies a distinct Japanese accent / phonetics.
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
    utterance.lang = "ja-JP";
  } else {
    // If no Japanese voice is installed, fall back to default but set lang hint
    utterance.lang = "ja-JP";
  }

  window.speechSynthesis.speak(utterance);
}
