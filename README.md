# 🏆 Quiz Buddy

A simple, beautiful, fun single-page web application to run real-life quiz game scorekeeping and participant board layout right on your mobile phone, tablet, or laptop.

---

## ✨ Features

- 🪑 **Interactive Participant Board**: Drag and move player boxes around the screen to match your physical table seating layout.
- 🎮 **Play Mode vs. 🛠️ Setup Mode**: Toggle between active gameplay (cards locked, tap adds +1 point) and setup mode (drag cards to arrange table).
- ➕ **Rapid Player Entry**: Tap Enter to add players quickly in succession.
- 👥 **Manage Participants Panel**: Central panel to view all players, cycle colors, or remove players.
- 🎨 **Custom Player Accent Colors**: Pick custom color themes for each participant.
- ➖ **Dedicated `-1` Button**: A small button inside each player card to subtract 1 point safely without misclicks.
- 🔄 **Safe Score Reset**: Clear all player totals back to 0 with a clear confirmation dialog.
- 💾 **Local Storage Auto-Save**: Keeps track of player names, colors, scores, and board positions even if you refresh or close the browser.
- 🔊 **Web Audio Sound Effects**: Synthesized audio chimes for point changes and mode toggles (includes header mute toggle).
- 💡 **Screen Wake Lock**: Prevents screen sleep or dimming while hosting a quiz night.
- 📦 **Single-File Bundle Output**: Zero-config build script compiles the entire app into a single, self-contained `dist/index.html` file that can be opened offline or hosted directly on **GitHub Pages**.

---

## 🚀 Quick Start (Local Development)

Simply open `src/index.html` in any web browser, or run a local HTTP server:

```bash
# Serve locally
npm start
```

---

## 📦 Build Standalone Single HTML File

To package all CSS, JS, and HTML into a single distribution file (`dist/index.html`):

```bash
npm run build
```

The resulting `dist/index.html` file can be downloaded, emailed, or shared with friends to open on any browser offline!

---

## 🌐 Deploy to GitHub Pages

1. Push this repository to GitHub (including `dist/index.html`).
2. In your GitHub repository settings:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` workflow will automatically build `dist/index.html` and publish your live quiz scorekeeper on GitHub Pages!
