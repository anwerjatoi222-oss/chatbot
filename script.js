/* University FAQ Chatbot - script.js
   - Loads FAQs from faqs.json
   - Keyword-overlap matching with threshold and fallback suggestions
   - SpeechRecognition voice input with Listening pulse animation
   - speechSynthesis voice output with mute toggle
   - localStorage chat history with Clear Chat
   - Dark/light mode toggle
   - Error handling: no speech support, mic permission denied, empty input
*/

(function () {
  // ---------- Configuration ----------
  const MATCH_THRESHOLD = 0.2;   // minimum score to accept a match
  const FALLBACK_SUGGESTIONS = 3; // how many related questions to suggest
  const FAQ_FILE = "faqs.json";
  const STORAGE_KEY = "university_faq_chat_history";

  // ---------- Elements ----------
  const messagesEl = document.getElementById("messages");
  const emptyStateEl = document.getElementById("empty-state");
  const chipsEl = document.getElementById("chips");
  const userInputEl = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const micStatusEl = document.getElementById("mic-status");
  const clearBtn = document.getElementById("clear-btn");
  const themeBtn = document.getElementById("theme-toggle");
  const voiceBtn = document.getElementById("voice-toggle");
  const welcomeMsg = document.getElementById("welcome-message");

  // ---------- State ----------
  let faqs = [];
  let isVoiceMuted = false;
  let recognition = null;
  let synth = window.speechSynthesis;
  let currentUtterance = null;

  // ---------- Init ----------
  async function init() {
    loadTheme();
    renderChips();
    loadHistory();

    userInputEl.addEventListener("input", () => {
      sendBtn.disabled = userInputEl.value.trim() === "";
    });

    sendBtn.addEventListener("click", handleSend);
    userInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSend();
    });

    micBtn.addEventListener("click", toggleMic);
    clearBtn.addEventListener("click", clearHistory);
    themeBtn.addEventListener("click", toggleTheme);
    voiceBtn.addEventListener("click", toggleVoice);

    try {
      const res = await fetch(FAQ_FILE);
      if (!res.ok) throw new Error("Failed to load FAQ data");
      const data = await res.json();
      faqs = Array.isArray(data.faqs) ? data.faqs : [];
    } catch (err) {
      console.error(err);
      addBotMessage("Sorry, I couldn't load the FAQ data. Please make sure you're viewing this page through a local server (e.g. open index.html via a server, not as a raw file).");
    }

    setupSpeech();
  }

  // ---------- Theming ----------
  function loadTheme() {
    const saved = localStorage.getItem("ufaq_theme");
    const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    updateThemeIcon(dark);
  }

  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("ufaq_theme", next);
    updateThemeIcon(next === "dark");
  }

  function updateThemeIcon(isDark) {
    themeBtn.querySelector(".icon").textContent = isDark ? "☀️" : "🌙";
    themeBtn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  }

  // ---------- Voice output ----------
  function toggleVoice() {
    isVoiceMuted = !isVoiceMuted;
    const icon = voiceBtn.querySelector(".icon");
    icon.textContent = isVoiceMuted ? "🔇" : "🔊";
    voiceBtn.title = isVoiceMuted ? "Unmute voice" : "Mute voice";
    if (isVoiceMuted && currentUtterance) {
      try { synth.cancel(); } catch (e) {}
      currentUtterance = null;
    }
  }

  function speak(text) {
    if (isVoiceMuted) return;
    try {
      synth.cancel();
      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.lang = "en-US";
      currentUtterance.rate = 1;
      currentUtterance.onend = () => { currentUtterance = null; };
      synth.speak(currentUtterance);
    } catch (e) {
      // Speech synthesis not available or blocked — silent fail
    }
  }

  // ---------- Speech recognition ----------
  function setupSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.disabled = true;
      micBtn.title = "Voice input not supported in this browser";
      micStatusEl.textContent = "Voice not supported";
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      micBtn.classList.add("listening");
      micStatusEl.textContent = "Listening…";
      userInputEl.disabled = true;
      sendBtn.disabled = true;
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        userInputEl.value = transcript;
        sendBtn.disabled = false;
        handleUserMessage(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micStatusEl.textContent = "Microphone permission denied";
      } else if (event.error === "no-speech") {
        micStatusEl.textContent = "No speech detected";
      } else {
        micStatusEl.textContent = "Voice error: " + event.error;
      }
      endListening();
    };

    recognition.onend = endListening;
  }

  function endListening() {
    micBtn.classList.remove("listening");
    micStatusEl.textContent = "Click to speak";
    userInputEl.disabled = false;
    if (userInputEl.value.trim()) sendBtn.disabled = false;
  }

  function toggleMic() {
    if (!recognition) {
      addBotMessage("Sorry, voice input isn't supported in this browser. Please type your question instead.");
      return;
    }
    if (micBtn.classList.contains("listening")) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch (e) {
      micStatusEl.textContent = "Could not start microphone";
      endListening();
    }
  }

  // ---------- Chat handling ----------
  function handleSend() {
    const text = userInputEl.value.trim();
    if (!text) return;
    userInputEl.value = "";
    sendBtn.disabled = true;
    handleUserMessage(text);
  }

  function handleUserMessage(text) {
    addUserMessage(text);
    scrollToBottom();

    const match = findBestMatch(text);
    setTimeout(() => {
      if (match && match.score >= MATCH_THRESHOLD) {
        addBotMessage(match.item.answer);
        speak(match.item.answer);
      } else {
        const suggestions = getRelatedSuggestions(text, match ? match.item : null);
        addBotMessage(buildFallbackMessage(suggestions));
        speak(buildFallbackMessage(suggestions, true));
      }
    }, 400);
  }

  function addUserMessage(text) {
    const msg = document.createElement("div");
    msg.className = "message user";
    msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>
                     <div class="meta">You</div>`;
    messagesEl.appendChild(msg);
    emptyStateEl.classList.add("hidden");
    welcomeMsg.classList.add("hidden");
    saveHistory();
  }

  function addBotMessage(text) {
    const msg = document.createElement("div");
    msg.className = "message bot";
    msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>
                     <div class="meta">Assistant</div>`;
    messagesEl.appendChild(msg);
    emptyStateEl.classList.add("hidden");
    saveHistory();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---------- Matching logic ----------
  function cleanText(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    return cleanText(text).split(/\s+/).filter(Boolean);
  }

  function findBestMatch(input) {
    const inputTokens = new Set(tokenize(input));
    if (inputTokens.size === 0) return null;

    let best = null;
    let bestScore = 0;

    for (const faq of faqs) {
      const faqTokens = new Set(tokenize(faq.question + " " + faq.keywords.join(" ")));
      if (faqTokens.size === 0) continue;

      let overlap = 0;
      for (const t of inputTokens) {
        if (faqTokens.has(t)) overlap++;
      }

      // Jaccard-like score: overlap / union size
      const union = new Set([...inputTokens, ...faqTokens]);
      const score = overlap / union.size;

      if (score > bestScore) {
        bestScore = score;
        best = faq;
      }
    }

    return { item: best, score: bestScore };
  }

  function getRelatedSuggestions(input, excludeItem) {
    const inputTokens = new Set(tokenize(input));
    const scored = faqs
      .filter((f) => f !== excludeItem)
      .map((f) => {
        const faqTokens = new Set(tokenize(f.question + " " + f.keywords.join(" ")));
        let overlap = 0;
        for (const t of inputTokens) if (faqTokens.has(t)) overlap++;
        const union = new Set([...inputTokens, ...faqTokens]);
        return { item: f, score: overlap / union.size };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, FALLBACK_SUGGESTIONS);

    return scored.map((s) => s.item);
  }

  function buildFallbackMessage(suggestions, forSpeech = false) {
    const base = "I'm not sure I understand. Could you rephrase your question? Here are some related topics you might ask about:";
    if (!suggestions || suggestions.length === 0) {
      return forSpeech ? base : base;
    }
    const list = suggestions.map((s) => "• " + s.question).join("\n");
    return base + "\n\n" + list;
  }

  // ---------- Suggested chips ----------
  function renderChips() {
    const starters = faqs.slice(0, 6).map((f) => f.question);
    chipsEl.innerHTML = starters
      .map((q) => `<button class="chip" type="button">${escapeHtml(q)}</button>`)
      .join("");
    chipsEl.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        userInputEl.value = btn.textContent;
        sendBtn.disabled = false;
        userInputEl.focus();
      });
    });
  }

  // ---------- localStorage history ----------
  function saveHistory() {
    const bubbles = Array.from(messagesEl.querySelectorAll(".bubble")).map((b) => b.textContent);
    const types = Array.from(messagesEl.querySelectorAll(".message")).map((m) =>
      m.classList.contains("user") ? "user" : "bot"
    );
    const history = bubbles.map((text, i) => ({ text, type: types[i] }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      // localStorage unavailable — silently ignore
    }
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const history = JSON.parse(raw);
      if (!Array.isArray(history)) return;
      welcomeMsg.classList.add("hidden");
      history.forEach((entry) => {
        if (entry.type === "user") addUserMessageRaw(entry.text);
        else addBotMessageRaw(entry.text);
      });
    } catch (e) {
      // ignore malformed history
    }
  }

  // Raw appenders used when restoring history (no duplicate save/speak)
  function addUserMessageRaw(text) {
    const msg = document.createElement("div");
    msg.className = "message user";
    msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>
                     <div class="meta">You</div>`;
    messagesEl.appendChild(msg);
    emptyStateEl.classList.add("hidden");
    welcomeMsg.classList.add("hidden");
  }

  function addBotMessageRaw(text) {
    const msg = document.createElement("div");
    msg.className = "message bot";
    msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>
                     <div class="meta">Assistant</div>`;
    messagesEl.appendChild(msg);
    emptyStateEl.classList.add("hidden");
    welcomeMsg.classList.add("hidden");
  }

  function clearHistory() {
    if (!confirm("Clear all chat history?")) return;
    messagesEl.innerHTML = "";
    messagesEl.appendChild(welcomeMsg);
    welcomeMsg.classList.remove("hidden");
    emptyStateEl.classList.remove("hidden");
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // ---------- Helpers ----------
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Start
  init();
})();
