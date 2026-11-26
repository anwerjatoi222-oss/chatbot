/* ==================== SIMPLE CHATBOT LOGIC ==================== */

// ---------- CONFIG ----------
const FAQ_FILE = "faqs.json";
const MATCH_THRESHOLD = 0.5;      // minimum score to show an answer (0 to 1)
const SUGGESTION_COUNT = 3;       // how many fallback suggestions to show
const STORAGE_KEY = "chat_history";
const CHIP_IDS = [1, 6, 12, 20, 27, 33]; // FAQ ids shown as quick question chips

// ---------- DOM ELEMENTS ----------
const chatArea = document.getElementById("chatArea");
const chipsContainer = document.getElementById("chips");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const clearBtn = document.getElementById("clearBtn");
const themeBtn = document.getElementById("themeBtn");
const voiceBtn = document.getElementById("voiceBtn");
const welcomeMsg = document.getElementById("welcomeMsg");

// ---------- STATE ----------
let faqs = [];                    // FAQ data loaded from JSON
let isVoiceMuted = false;         // voice output on/off
let recognition = null;           // speech recognition object
let synth = window.speechSynthesis; // speech synthesis

// ---------- INIT ----------
async function init() {
  loadTheme();           // load saved theme preference
  loadHistory();         // restore chat from localStorage
  await loadFAQs();      // fetch FAQ data from faqs.json
  renderChips();         // show quick question buttons (after FAQs are loaded)
  setupSpeech();         // prepare voice recognition
  bindEvents();          // attach click/listeners
}

// ---------- THEME ----------
function loadTheme() {
  const saved = localStorage.getItem("theme");
  const isDark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  themeBtn.textContent = isDark ? "☀️" : "🌙";
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  localStorage.setItem("theme", isDark ? "light" : "dark");
  themeBtn.textContent = isDark ? "🌙" : "☀️";
}

// ---------- VOICE OUTPUT (Text-to-Speech) ----------
function toggleVoice() {
  isVoiceMuted = !isVoiceMuted;
  voiceBtn.textContent = isVoiceMuted ? "🔇" : "🔊";
  if (isVoiceMuted) synth.cancel(); // stop speaking if muted
}

function speak(text) {
  if (isVoiceMuted) return;
  synth.cancel(); // stop any current speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  synth.speak(utterance);
}

// ---------- VOICE INPUT (Speech Recognition) ----------
function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = "Voice not supported in this browser";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  // When recognition starts
  recognition.onstart = () => {
    micBtn.classList.add("listening");
    micBtn.title = "Listening... click to stop";
    userInput.disabled = true;
    sendBtn.disabled = true;
  };

  // When speech is recognized
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.trim();
    if (text) {
      userInput.value = text;
      handleSend(); // process the recognized text
    }
  };

  // On error
  recognition.onerror = (e) => {
    if (e.error === "not-allowed") alert("Microphone permission denied");
    else if (e.error === "no-speech") alert("No speech detected");
    else console.error("Speech error:", e.error);
    stopListening();
  };

  // When recognition ends (for any reason)
  recognition.onend = stopListening;
}

function stopListening() {
  micBtn.classList.remove("listening");
  micBtn.title = "Click to speak";
  userInput.disabled = false;
}

function toggleMic() {
  if (!recognition) {
    alert("Voice input not supported in this browser. Use Chrome/Edge and serve via HTTP.");
    return;
  }
  if (micBtn.classList.contains("listening")) {
    recognition.stop();
  } else {
    try { recognition.start(); } catch (e) { alert("Could not start microphone"); }
  }
}

// ---------- LOAD FAQs ----------
async function loadFAQs() {
  try {
    const response = await fetch(FAQ_FILE, { cache: "no-store" });
    const data = await response.json();
    faqs = data.faqs || [];
  } catch (e) {
    console.error("Failed to load FAQs:", e);
    addBotMessage("Could not load FAQ data. Make sure you're running via a local server (not file://).");
  }
}

// ---------- EVENT BINDINGS ----------
function bindEvents() {
  // Send button
  sendBtn.onclick = handleSend;
  userInput.onkeydown = (e) => { if (e.key === "Enter") handleSend(); };

  // Mic button
  micBtn.onclick = toggleMic;

  // Clear chat
  clearBtn.onclick = () => {
    if (confirm("Clear all chat history?")) {
      chatArea.innerHTML = "";
      chatArea.appendChild(welcomeMsg);
      welcomeMsg.style.display = "block";
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Theme toggle
  themeBtn.onclick = toggleTheme;

  // Voice toggle
  voiceBtn.onclick = toggleVoice;

  // Enable/disable send button based on input
  userInput.oninput = () => { sendBtn.disabled = !userInput.value.trim(); };
}

// ---------- CHAT FUNCTIONS ----------
function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;
  userInput.value = "";
  sendBtn.disabled = true;

  addUserMessage(text);
  scrollToBottom();

  // Small delay before bot replies (feels more natural)
  setTimeout(() => {
    const match = findBestMatch(text);
    if (match && match.score >= MATCH_THRESHOLD) {
      addBotMessage(match.faq.answer);
      speak(match.faq.answer);
    } else {
      const suggestions = getSuggestions(text, match ? match.faq : null);
      const msg = buildFallbackMessage(suggestions);
      addBotMessage(msg);
      speak(msg.replace(/•/g, "").replace(/\n/g, " ")); // speak without bullets
    }
    scrollToBottom();
  }, 400);
}

function addUserMessage(text) {
  const div = document.createElement("div");
  div.className = "message user";
  div.innerHTML = `<div class="bubble">${escape(text)}</div>`;
  chatArea.appendChild(div);
  welcomeMsg.style.display = "none";
  saveHistory();
}

function addBotMessage(text) {
  const div = document.createElement("div");
  div.className = "message bot";
  div.innerHTML = `<div class="bubble">${escape(text).replace(/\n/g, "<br>")}</div>`;
  chatArea.appendChild(div);
  welcomeMsg.style.display = "none";
  saveHistory();
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

// Escape HTML to prevent XSS
function escape(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------- MATCHING LOGIC ----------
// Common words that do not help in matching
const STOP_WORDS = new Set((
  "a an the is are am was do does did can i my me we you your of to in on at for and or " +
  "how what which will be it this that with from about please tell give there any have has get"
).split(" "));

// Clean text: lowercase, remove punctuation, split into words
function getWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w);
}

// Very simple plural handling: "scholarships" -> "scholarship"
function stem(w) {
  return (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) ? w.slice(0, -1) : w;
}

// Meaningful words only (no stop words, plurals normalised)
function getKeyWords(text) {
  return getWords(text).filter(w => !STOP_WORDS.has(w)).map(stem);
}

// Score one FAQ against the user's words.
// Words found in the FAQ question count 1.0, words found in keywords count 0.8.
// Score = matched / number of user words, so short questions like "library fine" work.
function scoreFaq(inputWords, faq) {
  if (inputWords.size === 0) return 0;
  const questionWords = new Set(getKeyWords(faq.question));
  const keywordWords = new Set(faq.keywords.flatMap(k => getKeyWords(k)));

  let points = 0;
  for (const w of inputWords) {
    if (questionWords.has(w)) points += 1;
    else if (keywordWords.has(w)) points += 0.8;
  }
  // tiny penalty for very long questions so the more specific FAQ wins ties
  return points / inputWords.size - questionWords.size * 0.001;
}

// Find the best matching FAQ
function findBestMatch(input) {
  const inputWords = new Set(getKeyWords(input));
  if (inputWords.size === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const faq of faqs) {
    const score = scoreFaq(inputWords, faq);
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }
  return best ? { faq: best, score: bestScore } : null;
}

// Get fallback suggestions (related questions)
function getSuggestions(input, excludeFaq) {
  const inputWords = new Set(getKeyWords(input));
  return faqs
    .filter(f => f !== excludeFaq)
    .map(f => ({ faq: f, score: scoreFaq(inputWords, f) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SUGGESTION_COUNT)
    .map(x => x.faq);
}

function buildFallbackMessage(suggestions) {
  let msg = "I'm not sure I understand. Could you rephrase? Here are some related topics:";
  if (suggestions.length > 0) {
    msg += "\n\n" + suggestions.map(s => "• " + s.question).join("\n");
  }
  return msg;
}

// ---------- QUICK QUESTION CHIPS ----------
function renderChips() {
  // Show selected FAQ questions as clickable chips (falls back to first 6)
  let chipFaqs = CHIP_IDS.map(id => faqs.find(f => f.id === id)).filter(Boolean);
  if (chipFaqs.length === 0) chipFaqs = faqs.slice(0, 6);
  chipsContainer.innerHTML = chipFaqs.map(f => `<button class="chip">${escape(f.question)}</button>`).join("");

  // Click handler for each chip
  chipsContainer.querySelectorAll(".chip").forEach(btn => {
    btn.onclick = () => {
      userInput.value = btn.textContent;
      sendBtn.disabled = false;
      userInput.focus();
    };
  });
}

// ---------- LOCALSTORAGE HISTORY ----------
function saveHistory() {
  const messages = [];
  chatArea.querySelectorAll(".message").forEach(el => {
    if (el.id === "welcomeMsg") return;
    const isUser = el.classList.contains("user");
    const text = el.querySelector(".bubble").innerText;
    messages.push({ text, type: isUser ? "user" : "bot" });
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function loadHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!data.length) return;
    welcomeMsg.style.display = "none";
    data.forEach(m => {
      if (m.type === "user") addUserMessageRaw(m.text);
      else addBotMessageRaw(m.text);
    });
  } catch (e) { /* ignore corrupt data */ }
}

// Raw adders for history restore (no double-save)
function addUserMessageRaw(text) {
  const div = document.createElement("div");
  div.className = "message user";
  div.innerHTML = `<div class="bubble">${escape(text)}</div>`;
  chatArea.appendChild(div);
}
function addBotMessageRaw(text) {
  const div = document.createElement("div");
  div.className = "message bot";
  div.innerHTML = `<div class="bubble">${escape(text).replace(/\n/g, "<br>")}</div>`;
  chatArea.appendChild(div);
}

// ---------- START ----------
init();
