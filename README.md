# University FAQ Chatbot

A complete voice-enabled FAQ chatbot as a single-page web app using HTML, CSS, and vanilla JavaScript only (no backend, no frameworks).

## Features

- **Chat UI** — header, scrollable message area with user/bot bubbles, text input, Send button, Mic button
- **Voice input** — Web Speech API (SpeechRecognition); clicking the mic starts listening, shows a "Listening…" pulse animation, and puts recognized text into the chat
- **Voice output** — `speechSynthesis` reads the bot's reply aloud; mute/unmute toggle button
- **30 FAQ pairs** — stored in `faqs.json`, covering admission, fees, timetable, exams, library, societies, and contact info
- **Keyword-overlap matching** — scores each FAQ, returns the best match above a threshold; otherwise a polite fallback with 3 related suggestions
- **Suggested question chips** below the input for quick access
- **Chat history** saved in `localStorage`, with a Clear Chat button
- **Dark/light mode** toggle
- **Error handling** — no speech support, mic permission denied, empty input
- **Clean, modern, responsive design** with smooth animations

## Files

| File | Purpose |
|------|---------|
| `index.html` | Chat page markup |
| `style.css` | Theming, layout, animations (light/dark modes) |
| `script.js` | FAQ loading, matching, voice I/O, history, UI logic |
| `faqs.json` | 30 question-answer pairs with keywords |

## How to run

Speech recognition (`SpeechRecognition` / `webkitSpeechRecognition`) and `speechSynthesis` only work when the page is served over HTTP (not `file://`), and work best in **Chrome / Edge**.

### Option 1: Python (simplest)

From this folder:

```powershell
python -m http.server 8000
```

Then open: `http://localhost:8000`

### Option 2: Node.js

```powershell
npx http-server -p 8000
```

Then open: `http://localhost:8000`

### Option 3: VS Code "Live Server" extension

Open the folder in VS Code and click **Go Live** on `index.html`.

## Notes

- Use Chrome or Edge for the best Web Speech API support.
- On first mic use, the browser will ask for microphone permission — allow it to use voice input.
- If you open `index.html` directly as a file (`file://`), voice features may be blocked by browser security policy; serve via a local server instead.
- Chat history persists in your browser's `localStorage` until you click **Clear Chat**.
