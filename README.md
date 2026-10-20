# 💧 Furina chess — Furina P2P & Offline Chess

A feature-rich, serverless, peer-to-peer and offline multiplayer chess web application inspired by **Lady Furina** (Fontaine Hydro Archon from *Genshin Impact*). Built entirely with vanilla HTML5, CSS3, JavaScript, and external CDNs. It can be hosted directly on **GitHub Pages** with **zero backend server infrastructure**.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![WebRTC: PeerJS](https://img.shields.io/badge/WebRTC-PeerJS-cyan.svg)
![Rules: chess.js](https://img.shields.io/badge/Chess-chess.js-gold.svg)
![UI: chessboard.js](https://img.shields.io/badge/Board-chessboard.js-00d2ff.svg)
![Theme: Furina / Fontaine](https://img.shields.io/badge/Theme-Furina%20Fontaine-1e3a8a.svg)
![Offline: Pass & Play](https://img.shields.io/badge/Offline-Pass%20%26%20Play-emerald.svg)

---

## ✨ Features

### 🌐 1. Online Multiplayer (WebRTC P2P)
- **100% Serverless**: Connect directly browser-to-browser via **PeerJS**. No custom gameplay servers or databases.
- **Link-Sharing & QR Matching**: Host creates a game, copies the invite link (`?join=<peer_id>`), or presents an on-screen QR code for mobile friends.
- **Auto Join & Flip**: Challengers opening the link connect automatically and play as **Black** with the board flipped.

### 👥 2. Offline Two Player Modes (With & Without Bluetooth)
- **Pass & Play (Shared Screen)**: Play offline on the same phone, tablet, or PC with zero internet. Includes an **Auto-flip board each turn** toggle so each player always faces their side!
- **Bluetooth Offline Connectivity**: Uses the browser's **Web Bluetooth API** (`navigator.bluetooth`) to discover and pair with Bluetooth LE peripherals, controllers, or smart chessboards wirelessly.
- **Dual Window (BroadcastChannel)**: Play across two browser windows on the same PC completely offline using the standard HTML5 `BroadcastChannel` API.

### ⏱️ 3. Chess Clocks & Blitz Timers
- Choose from standard competitive time controls:
  - **No Clock (Casual)**
  - **1 min (Bullet)**
  - **3+2 Blitz (3 min + 2s increment)**
  - **5 min Blitz**
  - **10 min Rapid**
  - **15+10 Classical (15 min + 10s increment)**
- Digital synchronized countdown clocks on both player banners with millisecond precision.
- Visual alerts: clocks glow amber under 30s, and pulse crimson with audible ticks under 10s.
- Automatic **Timeout (Flag Fall)** detection.

### 🎵 4. Move Sound Customization & Background Fontaine Music
- **Synthesized Sound Themes** (Zero external audio files needed):
  - **Fontaine Opera**: Resonant wooden clicks and orchestral harp chords for checks.
  - **8-Bit Arcade**: Retro chiptune blips, noise captures, and arpeggios.
  - **Modern Minimal**: Clean subtle glass pops and soft tones.
- **Fontaine Theatrical Waltz Background Music**:
  - A procedural classical waltz synthesized entirely through the **Web Audio API** in 3/4 time with cello bass, harp arpeggios, and celesta melodies.
  - Play/Pause toggle in the header with dedicated volume sliders.

### ↩️ 5. Move Takeback / Undo
- **Online WebRTC Mode**: Click **"Takeback"** to send a royal petition to your opponent. A Furina confirmation modal lets the opponent grant or decline the dispensation.
- **Offline Mode**: Immediate 1-click **"Undo Move"** button.

### 🎭 6. Furina Theatrical Atmosphere & Full Chess Rules
- **Fontaine Aesthetics**: Royal navy and cyan glassmorphism with Fontaine gold filigree and dynamic court quotes.
- **Pawn Promotion Modal**: Select Queen, Rook, Bishop, or Knight with piece graphics.
- **Move Highlighting**: Legal move dots, capture rings, and check alerts.
- **Captured Pieces Counter**: Live material advantage counter (`+1`, `+3`, etc.).
- **Move History Log (PGN/SAN)**: Scrollable algebraic notation table.
- **In-Game Chat & Emotes**: Send messages and quick Furina quotes (*"Bravo!"*, *"Order in the Court!"*, *"Encore!"*).

---

## 🛠️ Tech Stack (All loaded via CDNs)

1. **[PeerJS](https://peerjs.com/) (`v1.5.4`)**: WebRTC peer-to-peer data channels.
2. **[chess.js](https://github.com/jhlywa/chess.js) (`v0.10.3`)**: Move validation, state engine, and PGN/FEN management.
3. **[chessboard.js](https://chessboardjs.com/) (`v1.0.0`)**: Drag-and-drop chessboard UI.
4. **[jQuery](https://jquery.com/) (`v3.7.1`)**: Peer dependency for chessboard.js.
5. **[Tailwind CSS](https://tailwindcss.com/)**: Modern responsive styling.
6. **[FontAwesome 6](https://fontawesome.com/)**: Rich iconography.
7. **[Google Fonts](https://fonts.google.com/)**: *Cinzel*, *Cinzel Decorative*, and *Plus Jakarta Sans*.

---

## 🚀 How to Run Locally

```bash
# In the project directory:
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

---

## 🌐 Deploy to GitHub Pages

1. Push this repository to GitHub: `https://github.com/Keerthik-T/Chess`
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
4. Select **Branch**: `main`, folder: `/(root)` and click **Save**.
5. Your chess duel stage will be live at:
   `https://keerthik-t.github.io/Chess/`
