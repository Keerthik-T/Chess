/**
 * ============================================================================
 * OPÉRA ÉPICLESSE — FURINA P2P & OFFLINE CHESS
 * Serverless, Peer-to-Peer, Offline Pass & Play, Bluetooth & Multi-Tab Chess
 * Theme: Lady Furina / Fontaine Hydro Archon (Genshin Impact)
 * ============================================================================
 */

(() => {
  'use strict';

  // ==========================================================================
  // 1. STATE MANAGEMENT
  // ==========================================================================

  let game = null;           // chess.js instance
  let board = null;          // chessboard.js instance
  let peer = null;           // PeerJS instance
  let connection = null;     // PeerJS DataConnection
  let broadcastChan = null;  // BroadcastChannel for offline same-device dual window
  let bluetoothDevice = null;// Web Bluetooth peripheral device

  let myPeerId = null;
  let targetPeerId = null;

  // Game Modes: 'online' | 'offline_local' | 'bluetooth' | 'offline_tab'
  let currentMode = 'online';

  // Player Color: 'w' (White) | 'b' (Black)
  let myColor = 'w';
  let opponentColor = 'b';
  let isHost = true;
  let isConnected = false;
  let isGameOver = false;

  // Offline Pass & Play Settings
  let autoFlipEnabled = true;

  // Chess Clocks / Timer State
  let timePreset = { base: 180, inc: 2 }; // Default 3+2
  let whiteTime = 180;
  let blackTime = 180;
  let clockInterval = null;
  let lastClockTick = 0;
  let clockRunning = false;

  // Audio & Synthesizer State
  let audioCtx = null;
  let soundStyle = 'opera'; // 'opera' | 'arcade' | 'modern'
  let soundVolume = 0.8;
  let musicVolume = 0.4;
  let isMusicPlaying = false;
  let musicLoopInterval = null;
  let musicMeasure = 0;

  // Promotion & Highlights
  let pendingPromotion = null;
  let lastMoveSquares = { from: null, to: null };

  // Furina Theatrical Quotes Engine
  const FURINA_QUOTES = {
    welcome: [
      '"The curtains are drawn! Let us see what drama you can orchestrate upon the 64 squares."',
      '"Step into the spotlight of the Opéra Épiclesse! Play with conviction, or suffer the verdict!"',
      '"A duel of supreme intellect! The Court of Fontaine awaits your grand performance."'
    ],
    gameStart: [
      '"Let the performance commence! Dual sovereigns clash upon the waters of Fontaine."',
      '"The stage is bathed in light. Make your opening gambit memorable!"'
    ],
    yourTurn: [
      '"The spotlight falls upon you. What decree will your pieces enact?"',
      '"A dramatic turn of events! Command the stage with elegance."',
      '"Take your time, yet do not keep the audience waiting too long."'
    ],
    opponentTurn: [
      '"Mademoiselle Crabaletta watches the opponent with intense scrutiny..."',
      '"The opposing sovereign ponders their next manoeuvre in the shadows."',
      '"Surintendante Chevalmarin reports the challenger is deep in thought."'
    ],
    check: [
      '"Order! Order in the Court! The King\'s sovereign position is gravely imperiled!"',
      '"The verdict draws near! Will the monarch evade this judicial strike?"'
    ],
    checkmateWhite: [
      '"The curtains descend! White has rendered the definitive judgment! Magnificent!"',
      '"Encore! Encore! A masterpiece of strategy concludes in triumphant checkmate!"'
    ],
    checkmateBlack: [
      '"Astonishing! Black delivers the fateful coup de grâce upon the grand stage!"',
      '"A dramatic inversion of fortune! Black seizes the final acclaim!"'
    ],
    timeOut: [
      '"The sands of Fontaine have elapsed! The chronometer tolls for the fallen monarch!"',
      '"Time itself renders the final judgment! A tragic fall of the flag!"'
    ],
    draw: [
      '"An exquisite impasse! The scales of Fontaine balance in absolute harmony."',
      '"Neither king yields! The court records an honorable, dramatic draw."'
    ],
    disconnect: [
      '"The mystical hydro resonance has fractured! The challenger vanished into thin air."',
      '"A sudden departure from the stage! The performance hangs suspended."'
    ]
  };

  // ==========================================================================
  // 2. DOM ELEMENT REFERENCES
  // ==========================================================================

  const dom = {
    // Mode Switcher
    modeTabs: document.querySelectorAll('.mode-tab-btn'),
    activeModeBadgeText: document.getElementById('activeModeBadgeText'),
    lobbySection: document.getElementById('lobbySection'),
    onlineLobbyGrid: document.getElementById('onlineLobbyGrid'),
    offlinePassPlayLobby: document.getElementById('offlinePassPlayLobby'),
    bluetoothLobby: document.getElementById('bluetoothLobby'),
    offlineMultiTabLobby: document.getElementById('offlineMultiTabLobby'),

    // Timer Selector
    timerButtons: document.querySelectorAll('.timer-select-btn'),

    // Quotes & Pills
    furinaQuoteText: document.getElementById('furinaQuoteText'),
    connectionPill: document.getElementById('connectionPill'),
    connectionPillText: document.getElementById('connectionPillText'),

    // Host & Join elements
    hostCard: document.getElementById('hostCard'),
    joinCard: document.getElementById('joinCard'),
    createGameBtn: document.getElementById('createGameBtn'),
    hostInitialActions: document.getElementById('hostInitialActions'),
    hostLinkBox: document.getElementById('hostLinkBox'),
    hostPeerBadge: document.getElementById('hostPeerBadge'),
    shareLinkInput: document.getElementById('shareLinkInput'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    copyIcon: document.getElementById('copyIcon'),
    copyBtnText: document.getElementById('copyBtnText'),
    showQrBtn: document.getElementById('showQrBtn'),

    joinDefaultContent: document.getElementById('joinDefaultContent'),
    manualJoinInput: document.getElementById('manualJoinInput'),
    manualJoinBtn: document.getElementById('manualJoinBtn'),
    autoJoinState: document.getElementById('autoJoinState'),
    autoJoinHostText: document.getElementById('autoJoinHostText'),
    cancelJoinBtn: document.getElementById('cancelJoinBtn'),

    // Offline & Bluetooth Buttons
    autoFlipToggle: document.getElementById('autoFlipToggle'),
    startPassPlayBtn: document.getElementById('startPassPlayBtn'),
    bluetoothSupportBadge: document.getElementById('bluetoothSupportBadge'),
    bluetoothDesc: document.getElementById('bluetoothDesc'),
    scanBluetoothBtn: document.getElementById('scanBluetoothBtn'),
    startBtSimulationBtn: document.getElementById('startBtSimulationBtn'),
    startBroadcastWhiteBtn: document.getElementById('startBroadcastWhiteBtn'),
    startBroadcastBlackBtn: document.getElementById('startBroadcastBlackBtn'),

    // Chessboard & Players
    chessBoard: document.getElementById('chessBoard'),
    floatingCheckBanner: document.getElementById('floatingCheckBanner'),
    floatingCheckText: document.getElementById('floatingCheckText'),

    opponentName: document.getElementById('opponentName'),
    opponentColorBadge: document.getElementById('opponentColorBadge'),
    opponentAvatar: document.getElementById('opponentAvatar'),
    opponentTurnBadge: document.getElementById('opponentTurnBadge'),
    opponentCapturedPieces: document.getElementById('opponentCapturedPieces'),
    opponentScoreAdvantage: document.getElementById('opponentScoreAdvantage'),
    opponentClockTime: document.getElementById('opponentClockTime'),
    opponentClockWrapper: document.getElementById('opponentClockWrapper'),

    selfName: document.getElementById('selfName'),
    selfColorBadge: document.getElementById('selfColorBadge'),
    selfAvatar: document.getElementById('selfAvatar'),
    selfTurnBadge: document.getElementById('selfTurnBadge'),
    selfTurnText: document.getElementById('selfTurnText'),
    selfCapturedPieces: document.getElementById('selfCapturedPieces'),
    selfScoreAdvantage: document.getElementById('selfScoreAdvantage'),
    selfClockTime: document.getElementById('selfClockTime'),
    selfClockWrapper: document.getElementById('selfClockWrapper'),

    // Utilities & Actions
    takebackBtn: document.getElementById('takebackBtn'),
    takebackBtnText: document.getElementById('takebackBtnText'),
    flipBoardBtn: document.getElementById('flipBoardBtn'),
    fenCopyBtn: document.getElementById('fenCopyBtn'),
    offerDrawBtn: document.getElementById('offerDrawBtn'),
    resignBtn: document.getElementById('resignBtn'),
    navNewGameBtn: document.getElementById('navNewGameBtn'),

    // Status & Moves
    moveCountBadge: document.getElementById('moveCountBadge'),
    verdictStatusIcon: document.getElementById('verdictStatusIcon'),
    verdictStatusTitle: document.getElementById('verdictStatusTitle'),
    verdictStatusDesc: document.getElementById('verdictStatusDesc'),
    moveLogContainer: document.getElementById('moveLogContainer'),
    emptyMovePlaceholder: document.getElementById('emptyMovePlaceholder'),
    moveLogList: document.getElementById('moveLogList'),

    // Chat
    chatChannelBadge: document.getElementById('chatChannelBadge'),
    chatMessages: document.getElementById('chatMessages'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),

    // Audio & Modals
    bgMusicToggleBtn: document.getElementById('bgMusicToggleBtn'),
    bgMusicIcon: document.getElementById('bgMusicIcon'),
    bgMusicLabel: document.getElementById('bgMusicLabel'),
    soundSettingsBtn: document.getElementById('soundSettingsBtn'),
    soundSettingsModal: document.getElementById('soundSettingsModal'),
    closeSoundSettingsBtn: document.getElementById('closeSoundSettingsBtn'),
    dismissSoundSettingsBtn: document.getElementById('dismissSoundSettingsBtn'),
    modalMusicToggleBtn: document.getElementById('modalMusicToggleBtn'),
    musicVolumeSlider: document.getElementById('musicVolumeSlider'),
    sfxVolumeSlider: document.getElementById('sfxVolumeSlider'),
    sfxVolumeLabel: document.getElementById('sfxVolumeLabel'),
    soundStyleButtons: document.querySelectorAll('.sound-style-btn'),

    helpModalBtn: document.getElementById('helpModalBtn'),
    helpModal: document.getElementById('helpModal'),
    closeHelpModalBtn: document.getElementById('closeHelpModalBtn'),
    dismissHelpBtn: document.getElementById('dismissHelpBtn'),

    promotionModal: document.getElementById('promotionModal'),
    promoImgQ: document.getElementById('promoImgQ'),
    promoImgR: document.getElementById('promoImgR'),
    promoImgB: document.getElementById('promoImgB'),
    promoImgN: document.getElementById('promoImgN'),

    takebackModal: document.getElementById('takebackModal'),
    acceptTakebackBtn: document.getElementById('acceptTakebackBtn'),
    declineTakebackBtn: document.getElementById('declineTakebackBtn'),

    gameOverModal: document.getElementById('gameOverModal'),
    gameOverIcon: document.getElementById('gameOverIcon'),
    gameOverTitle: document.getElementById('gameOverTitle'),
    gameOverSubtitle: document.getElementById('gameOverSubtitle'),
    gameOverQuote: document.getElementById('gameOverQuote'),
    rematchBtn: document.getElementById('rematchBtn'),
    closeGameOverModalBtn: document.getElementById('closeGameOverModalBtn'),

    qrModal: document.getElementById('qrModal'),
    qrImage: document.getElementById('qrImage'),
    closeQrModalBtn: document.getElementById('closeQrModalBtn'),

    toastContainer: document.getElementById('toastContainer')
  };

  // ==========================================================================
  // 3. WEB AUDIO SYNTHESIZER & FONTAINE WALTZ BACKGROUND MUSIC
  // ==========================================================================

  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (soundVolume <= 0) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(soundVolume, now);
      masterGain.connect(ctx.destination);

      if (soundStyle === 'arcade') {
        // 8-BIT RETRO CHIPTUNE
        playArcadeSound(ctx, masterGain, type, now);
      } else if (soundStyle === 'modern') {
        // MODERN MINIMAL GLASS
        playModernSound(ctx, masterGain, type, now);
      } else {
        // FONTAINE OPERA (DEFAULT)
        playOperaSound(ctx, masterGain, type, now);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  function playOperaSound(ctx, masterGain, type, now) {
    if (type === 'move') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.08);

    } else if (type === 'capture') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.12);

    } else if (type === 'check') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);

        gain.gain.setValueAtTime(0.2, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65 + i * 0.04);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.04);
        osc.stop(now + 0.7 + i * 0.04);
      });

    } else if (type === 'victory') {
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);

        gain.gain.setValueAtTime(0.3, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.45);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.46);
      });

    } else if (type === 'defeat') {
      [440, 415.3, 392, 349.23].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.25, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.5);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.52);
      });

    } else if (type === 'tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.04);

    } else if (type === 'droplet') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.06);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  }

  function playArcadeSound(ctx, masterGain, type, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';

    if (type === 'move') {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(440, now + 0.04);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.08);

    } else if (type === 'capture') {
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.12);

    } else if (type === 'check') {
      [330, 440, 660].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(f, now + i * 0.06);
        g.gain.setValueAtTime(0.18, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.1);
        o.connect(g);
        g.connect(masterGain);
        o.start(now + i * 0.06);
        o.stop(now + i * 0.06 + 0.1);
      });

    } else {
      playOperaSound(ctx, masterGain, type, now);
    }
  }

  function playModernSound(ctx, masterGain, type, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    if (type === 'move') {
      osc.frequency.setValueAtTime(540, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.04);

    } else if (type === 'capture') {
      osc.frequency.setValueAtTime(920, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.06);

    } else {
      playOperaSound(ctx, masterGain, type, now);
    }
  }

  // Procedural Fontaine Theatrical Waltz Synthesizer
  function toggleBackgroundMusic() {
    isMusicPlaying = !isMusicPlaying;
    if (isMusicPlaying) {
      startFontaineWaltz();
      dom.bgMusicIcon.className = 'fa-solid fa-music text-fontaine-gold animate-bounce';
      dom.bgMusicLabel.textContent = 'Waltz On';
      dom.modalMusicToggleBtn.textContent = 'Pause Waltz';
      showToast('Fontaine Theatrical Waltz commenced 🎭', 'info');
    } else {
      stopFontaineWaltz();
      dom.bgMusicIcon.className = 'fa-solid fa-music text-cyan-400';
      dom.bgMusicLabel.textContent = 'Waltz Off';
      dom.modalMusicToggleBtn.textContent = 'Play Waltz';
      showToast('Waltz paused.', 'info');
    }
  }

  function startFontaineWaltz() {
    stopFontaineWaltz();
    const ctx = getAudioContext();
    if (!ctx) return;

    // Waltz progression: F minor -> Bb minor -> C major -> F minor (3/4 time)
    const chords = [
      { bass: 87.31, chord: [261.63, 311.13, 392.00] }, // Fm
      { bass: 116.54, chord: [293.66, 349.23, 466.16] }, // Bbm
      { bass: 130.81, chord: [261.63, 329.63, 392.00] }, // C maj
      { bass: 87.31, chord: [261.63, 311.13, 392.00] }  // Fm
    ];

    const melody = [
      [523.25, 622.25, 783.99],
      [466.16, 523.25, 698.46],
      [523.25, 659.25, 783.99],
      [783.99, 698.46, 523.25]
    ];

    let beat = 0;
    musicMeasure = 0;

    musicLoopInterval = setInterval(() => {
      if (!isMusicPlaying || musicVolume <= 0) return;
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(musicVolume * 0.45, now);
      master.connect(ctx.destination);

      const currentChord = chords[musicMeasure % chords.length];

      if (beat === 0) {
        // Beat 1: Warm Cello Bass Note
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(currentChord.bass, now);
        bassGain.gain.setValueAtTime(0.4, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        bassOsc.connect(bassGain);
        bassGain.connect(master);
        bassOsc.start(now);
        bassOsc.stop(now + 0.6);

        // Melody note on Beat 1
        const melOsc = ctx.createOscillator();
        const melGain = ctx.createGain();
        melOsc.type = 'sine';
        melOsc.frequency.setValueAtTime(melody[musicMeasure % melody.length][0], now);
        melGain.gain.setValueAtTime(0.2, now);
        melGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        melOsc.connect(melGain);
        melGain.connect(master);
        melOsc.start(now);
        melOsc.stop(now + 0.5);

      } else {
        // Beats 2 & 3: Delicate Fontaine Celesta / Harp Chords
        currentChord.chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.02);
          gain.gain.setValueAtTime(0.12, now + idx * 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(master);
          osc.start(now + idx * 0.02);
          osc.stop(now + 0.36);
        });
      }

      beat = (beat + 1) % 3;
      if (beat === 0) {
        musicMeasure++;
      }
    }, 450); // ~133 BPM in 3/4 waltz time
  }

  function stopFontaineWaltz() {
    if (musicLoopInterval) {
      clearInterval(musicLoopInterval);
      musicLoopInterval = null;
    }
  }

  // ==========================================================================
  // 4. CHESS CLOCK & TIMER ENGINE
  // ==========================================================================

  function resetClocks() {
    stopClock();
    whiteTime = timePreset.base;
    blackTime = timePreset.base;
    updateClockDisplay();
  }

  function startClock() {
    if (timePreset.base === 0) return; // Casual / No Clock
    stopClock();
    clockRunning = true;
    lastClockTick = Date.now();

    clockInterval = setInterval(() => {
      if (!clockRunning || isGameOver) return;
      const now = Date.now();
      const delta = (now - lastClockTick) / 1000;
      lastClockTick = now;

      const activeColor = game.turn();
      if (activeColor === 'w') {
        whiteTime = Math.max(0, whiteTime - delta);
        if (whiteTime <= 0) {
          handleTimeOut('w');
        }
      } else {
        blackTime = Math.max(0, blackTime - delta);
        if (blackTime <= 0) {
          handleTimeOut('b');
        }
      }

      updateClockDisplay();
    }, 100);
  }

  function stopClock() {
    clockRunning = false;
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  }

  function switchClockTurn() {
    if (timePreset.base === 0) return;
    // Add increment to the player who just moved
    const prevColor = game.turn() === 'w' ? 'b' : 'w';
    if (prevColor === 'w') {
      whiteTime += timePreset.inc;
    } else {
      blackTime += timePreset.inc;
    }
    lastClockTick = Date.now();
    updateClockDisplay();
  }

  function updateClockDisplay() {
    if (timePreset.base === 0) {
      dom.selfClockTime.textContent = 'Untimed';
      dom.opponentClockTime.textContent = 'Untimed';
      return;
    }

    const myTimeVal = myColor === 'w' ? whiteTime : blackTime;
    const oppTimeVal = myColor === 'w' ? blackTime : whiteTime;

    dom.selfClockTime.textContent = formatTime(myTimeVal);
    dom.opponentClockTime.textContent = formatTime(oppTimeVal);

    // Active clock highlight
    const isMyTurn = game.turn() === myColor;
    if (isMyTurn && clockRunning) {
      dom.selfClockWrapper.className = 'chess-clock-box active-clock';
      dom.opponentClockWrapper.className = 'chess-clock-box';
    } else if (!isMyTurn && clockRunning) {
      dom.selfClockWrapper.className = 'chess-clock-box';
      dom.opponentClockWrapper.className = 'chess-clock-box active-clock';
    } else {
      dom.selfClockWrapper.className = 'chess-clock-box';
      dom.opponentClockWrapper.className = 'chess-clock-box';
    }

    // Low time visual & sound cues
    applyLowTimeClasses(dom.selfClockWrapper, myTimeVal);
    applyLowTimeClasses(dom.opponentClockWrapper, oppTimeVal);
  }

  function applyLowTimeClasses(wrapper, timeSeconds) {
    if (timeSeconds <= 10) {
      wrapper.classList.add('critical-time');
      wrapper.classList.remove('low-time');
    } else if (timeSeconds <= 30) {
      wrapper.classList.add('low-time');
      wrapper.classList.remove('critical-time');
    } else {
      wrapper.classList.remove('low-time', 'critical-time');
    }
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function handleTimeOut(flaggedColor) {
    stopClock();
    isGameOver = true;
    const winnerColor = flaggedColor === 'w' ? 'b' : 'w';
    const isWinner = winnerColor === myColor;

    if (currentMode === 'offline_local') {
      const winnerName = winnerColor === 'w' ? 'White' : 'Black';
      playSound('victory');
      triggerGameOverModal(
        `Time Out! ${winnerName} Wins`,
        `${flaggedColor === 'w' ? 'White' : 'Black'} has exhausted their clock.`,
        FURINA_QUOTES.timeOut[0],
        null
      );
    } else if (isWinner) {
      playSound('victory');
      triggerGameOverModal(
        'Victory on Time!',
        'Opponent has flagged! Their allotted minutes have dissolved into the waters.',
        FURINA_QUOTES.timeOut[0],
        true
      );
    } else {
      playSound('defeat');
      triggerGameOverModal(
        'Defeat on Time',
        'Your chronometer has run dry. The verdict is rendered against you.',
        FURINA_QUOTES.timeOut[1],
        false
      );
    }
  }

  // ==========================================================================
  // 5. TOAST NOTIFICATIONS & QUOTE ENGINE
  // ==========================================================================

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-2.5 text-xs font-medium tracking-wide animate-scale-up transition-all duration-300 pointer-events-auto ${
      type === 'success'
        ? 'bg-cyan-950/90 text-cyan-200 border-cyan-500/50'
        : type === 'warning'
        ? 'bg-amber-950/90 text-amber-200 border-amber-500/50'
        : type === 'error'
        ? 'bg-rose-950/90 text-rose-200 border-rose-500/50'
        : 'bg-fontaine-900/90 text-fontaine-pearl border-fontaine-700'
    }`;

    const iconClass =
      type === 'success' ? 'fa-circle-check text-cyan-400' :
      type === 'warning' ? 'fa-triangle-exclamation text-amber-400' :
      type === 'error' ? 'fa-circle-xmark text-rose-400' : 'fa-circle-info text-fontaine-gold';

    toast.innerHTML = `<i class="fa-solid ${iconClass} text-sm shrink-0"></i><span>${message}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  function setFurinaQuote(category) {
    const quotes = FURINA_QUOTES[category] || FURINA_QUOTES.welcome;
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    dom.furinaQuoteText.textContent = randomQuote;
  }

  // ==========================================================================
  // 6. CHESS ENGINE & BOARD INITIALIZATION
  // ==========================================================================

  function initChess() {
    game = new Chess();

    const config = {
      draggable: true,
      position: 'start',
      orientation: myColor === 'w' ? 'white' : 'black',
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
      onDragStart: handleDragStart,
      onDrop: handleDrop,
      onSnapEnd: handleSnapEnd
    };

    board = Chessboard('chessBoard', config);

    window.addEventListener('resize', () => {
      if (board) {
        board.resize();
        reapplyLastMoveHighlights();
      }
    });

    updateUI();
  }

  // ==========================================================================
  // 7. DRAG-AND-DROP & MOVE VALIDATION
  // ==========================================================================

  function handleDragStart(source, piece, position, orientation) {
    if (game.game_over() || isGameOver) return false;

    if (currentMode === 'offline_local') {
      // In local mode, only allow the piece whose turn it is
      const turn = game.turn();
      if ((turn === 'w' && piece.search(/^b/) !== -1) || (turn === 'b' && piece.search(/^w/) !== -1)) {
        return false;
      }
      highlightLegalMoves(source);
      return true;
    }

    // In online / multi-tab / bluetooth mode:
    if (!isConnected) {
      showToast('Awaiting connection to opponent!', 'warning');
      return false;
    }

    if (game.turn() !== myColor) return false;

    if (
      (myColor === 'w' && piece.search(/^b/) !== -1) ||
      (myColor === 'b' && piece.search(/^w/) !== -1)
    ) {
      return false;
    }

    highlightLegalMoves(source);
    return true;
  }

  function handleDrop(source, target) {
    removeSquareHighlights();
    if (source === target) return;

    const isPromo = isPromotionMove(source, target);
    if (isPromo) {
      const testMove = game.move({ from: source, to: target, promotion: 'q' });
      if (testMove === null) return 'snapback';
      game.undo();
      pendingPromotion = { source, target };
      openPromotionModal();
      return 'snapback';
    }

    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    onMoveExecuted(move);

    // Broadcast move according to mode
    broadcastMove(move);
  }

  function handleSnapEnd() {
    board.position(game.fen());
    reapplyLastMoveHighlights();

    // Auto-flip board in Pass & Play if enabled
    if (currentMode === 'offline_local' && autoFlipEnabled && !isGameOver) {
      const nextTurn = game.turn();
      board.orientation(nextTurn === 'w' ? 'white' : 'black');
    }
  }

  function isPromotionMove(source, target) {
    const piece = game.get(source);
    if (!piece || piece.type !== 'p') return false;
    if (piece.color !== game.turn()) return false;
    const targetRank = target.charAt(1);
    return (
      (piece.color === 'w' && targetRank === '8') ||
      (piece.color === 'b' && targetRank === '1')
    );
  }

  function onMoveExecuted(move) {
    lastMoveSquares.from = move.from;
    lastMoveSquares.to = move.to;

    if (move.captured) {
      playSound('capture');
    } else {
      playSound('move');
    }

    // Start clock on first move
    if (!clockRunning && timePreset.base > 0) {
      startClock();
    } else {
      switchClockTurn();
    }

    updateUI();
    reapplyLastMoveHighlights();
    checkGameStatus();
  }

  function broadcastMove(move) {
    const packet = {
      type: 'move',
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      san: move.san,
      fen: game.fen(),
      whiteTime: whiteTime,
      blackTime: blackTime
    };

    if (currentMode === 'online') {
      sendWebRTC(packet);
    } else if (currentMode === 'offline_tab' && broadcastChan) {
      broadcastChan.postMessage(packet);
    }
  }

  // ==========================================================================
  // 8. SQUARE HIGHLIGHTING
  // ==========================================================================

  function removeSquareHighlights() {
    $('#chessBoard .square-55d63').removeClass(
      'highlight-legal highlight-legal-capture highlight-selected'
    );
  }

  function highlightLegalMoves(source) {
    removeSquareHighlights();
    $('#chessBoard .square-' + source).addClass('highlight-selected');

    const moves = game.moves({ square: source, verbose: true });
    if (moves.length === 0) return;

    for (let i = 0; i < moves.length; i++) {
      const destSquare = moves[i].to;
      const $square = $('#chessBoard .square-' + destSquare);
      if (moves[i].captured) {
        $square.addClass('highlight-legal-capture');
      } else {
        $square.addClass('highlight-legal');
      }
    }
  }

  function reapplyLastMoveHighlights() {
    $('#chessBoard .square-55d63').removeClass('highlight-last-move highlight-check');

    if (lastMoveSquares.from && lastMoveSquares.to) {
      $('#chessBoard .square-' + lastMoveSquares.from).addClass('highlight-last-move');
      $('#chessBoard .square-' + lastMoveSquares.to).addClass('highlight-last-move');
    }

    if (game.in_check()) {
      const kingSquare = findKingSquare(game.turn());
      if (kingSquare) {
        $('#chessBoard .square-' + kingSquare).addClass('highlight-check');
      }
    }
  }

  function findKingSquare(color) {
    const b = game.board();
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = b[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          return files[c] + (8 - r);
        }
      }
    }
    return null;
  }

  // ==========================================================================
  // 9. PROMOTION MODAL LOGIC
  // ==========================================================================

  function openPromotionModal() {
    const promoColor = game.turn();
    const prefix = promoColor === 'w' ? 'w' : 'b';
    dom.promoImgQ.src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}Q.png`;
    dom.promoImgR.src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}R.png`;
    dom.promoImgB.src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}B.png`;
    dom.promoImgN.src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}N.png`;

    dom.promotionModal.classList.remove('hidden');
    dom.promotionModal.classList.add('flex');
    playSound('droplet');
  }

  function closePromotionModal() {
    dom.promotionModal.classList.add('hidden');
    dom.promotionModal.classList.remove('flex');
  }

  function selectPromotionPiece(pieceType) {
    closePromotionModal();
    if (!pendingPromotion) return;

    const { source, target } = pendingPromotion;
    pendingPromotion = null;

    const move = game.move({ from: source, to: target, promotion: pieceType });
    if (move) {
      board.position(game.fen());
      onMoveExecuted(move);
      broadcastMove(move);
    }
  }

  // ==========================================================================
  // 10. MOVE TAKEBACK / UNDO PROTOCOL
  // ==========================================================================

  function handleTakebackRequest() {
    if (game.history().length === 0) {
      showToast('No moves have been made yet to retract.', 'warning');
      return;
    }

    if (currentMode === 'offline_local') {
      // Local mode: immediate undo
      executeUndo();
      showToast('Last move retracted by royal decree.', 'info');
      return;
    }

    if (!isConnected) {
      showToast('Connect with an opponent to request takeback.', 'warning');
      return;
    }

    // Online / Multi-tab: send request
    const packet = { type: 'takeback_request' };
    if (currentMode === 'online') sendWebRTC(packet);
    if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);

    showToast('Takeback petition submitted to opponent...', 'info');
  }

  function executeUndo() {
    const undone = game.undo();
    if (!undone) return;

    board.position(game.fen());
    const hist = game.history({ verbose: true });
    if (hist.length > 0) {
      const last = hist[hist.length - 1];
      lastMoveSquares.from = last.from;
      lastMoveSquares.to = last.to;
    } else {
      lastMoveSquares = { from: null, to: null };
    }

    updateUI();
    reapplyLastMoveHighlights();
    playSound('droplet');
  }

  // ==========================================================================
  // 11. WIN / LOSS / DRAW CHECKS
  // ==========================================================================

  function checkGameStatus() {
    const isMyTurn = game.turn() === myColor;

    if (game.in_check() && !game.in_checkmate()) {
      playSound('check');
      dom.floatingCheckBanner.classList.remove('hidden');
      dom.floatingCheckBanner.classList.add('flex');
      dom.floatingCheckText.textContent = isMyTurn
        ? 'Check! Your Sovereign is Imperiled!'
        : 'Opponent King is in Check!';
      setFurinaQuote('check');
    } else {
      dom.floatingCheckBanner.classList.add('hidden');
      dom.floatingCheckBanner.classList.remove('flex');
    }

    if (game.in_checkmate()) {
      isGameOver = true;
      stopClock();
      const winnerColor = game.turn() === 'w' ? 'b' : 'w';
      const isWinner = winnerColor === myColor;

      if (currentMode === 'offline_local') {
        playSound('victory');
        triggerGameOverModal(
          'Checkmate!',
          `${winnerColor === 'w' ? 'White' : 'Black'} delivers triumphant checkmate!`,
          FURINA_QUOTES.checkmateWhite[0],
          null
        );
      } else if (isWinner) {
        playSound('victory');
        triggerGameOverModal(
          'Victory by Checkmate!',
          'Glorious triumph! You have vanquished the opposing sovereign.',
          winnerColor === 'w' ? FURINA_QUOTES.checkmateWhite[0] : FURINA_QUOTES.checkmateBlack[0],
          true
        );
      } else {
        playSound('defeat');
        triggerGameOverModal(
          'Defeat by Checkmate',
          'The curtains fall upon your king. The verdict has been rendered against you.',
          winnerColor === 'w' ? FURINA_QUOTES.checkmateWhite[1] : FURINA_QUOTES.checkmateBlack[1],
          false
        );
      }
      return;
    }

    if (game.in_stalemate()) {
      isGameOver = true;
      stopClock();
      playSound('defeat');
      triggerGameOverModal('Stalemate (Draw)', 'No legal moves remain. Absolute stalemate!', FURINA_QUOTES.draw[0], null);
      return;
    }

    if (game.in_threefold_repetition()) {
      isGameOver = true;
      stopClock();
      playSound('defeat');
      triggerGameOverModal('Threefold Repetition', 'Exact position repeated thrice on stage. Draw.', FURINA_QUOTES.draw[1], null);
      return;
    }

    if (game.insufficient_material() || game.in_draw()) {
      isGameOver = true;
      stopClock();
      playSound('defeat');
      triggerGameOverModal('Draw Declared', 'The court records an honorable draw.', FURINA_QUOTES.draw[0], null);
      return;
    }

    if (isConnected) {
      if (isMyTurn) setFurinaQuote('yourTurn');
      else setFurinaQuote('opponentTurn');
    }
  }

  function triggerGameOverModal(title, subtitle, quote, isWinner) {
    dom.gameOverTitle.textContent = title;
    dom.gameOverSubtitle.textContent = subtitle;
    dom.gameOverQuote.textContent = quote;

    if (isWinner === true) {
      dom.gameOverIcon.className = 'fa-solid fa-trophy text-fontaine-gold';
    } else if (isWinner === false) {
      dom.gameOverIcon.className = 'fa-solid fa-heart-crack text-rose-400';
    } else {
      dom.gameOverIcon.className = 'fa-solid fa-scale-balanced text-cyan-300';
    }

    dom.gameOverModal.classList.remove('hidden');
    dom.gameOverModal.classList.add('flex');
  }

  function closeGameOverModal() {
    dom.gameOverModal.classList.add('hidden');
    dom.gameOverModal.classList.remove('flex');
  }

  // ==========================================================================
  // 12. UI SYNCHRONIZATION
  // ==========================================================================

  function updateUI() {
    const isMyTurn = game.turn() === myColor;
    const currentTurnColor = game.turn() === 'w' ? 'White' : 'Black';

    const moveNumber = Math.floor(game.history().length / 2) + 1;
    dom.moveCountBadge.textContent = `Move ${moveNumber} (${currentTurnColor})`;

    if (currentMode === 'offline_local') {
      dom.selfTurnBadge.classList.remove('hidden');
      dom.selfTurnBadge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/50';
      dom.selfTurnText.textContent = `${currentTurnColor}'s Move`;
      dom.opponentTurnBadge.classList.add('hidden');

      dom.verdictStatusTitle.textContent = `Local Duel: ${currentTurnColor} to Move`;
      dom.verdictStatusDesc.textContent = 'Pass the device or play on the shared screen.';
      dom.verdictStatusIcon.className = 'fa-solid fa-users text-cyan-400 mt-0.5';

    } else if (!isConnected) {
      dom.selfTurnBadge.classList.remove('hidden');
      dom.selfTurnBadge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-600/50';
      dom.selfTurnText.textContent = 'Waiting for Opponent';
      dom.opponentTurnBadge.classList.add('hidden');

      dom.verdictStatusTitle.textContent = 'Awaiting Opponent Connection';
      dom.verdictStatusDesc.textContent = 'Share your invitation link, scan QR, or pair devices to begin.';
      dom.verdictStatusIcon.className = 'fa-solid fa-hourglass-half text-amber-400 mt-0.5';

    } else if (isGameOver) {
      dom.selfTurnBadge.classList.add('hidden');
      dom.opponentTurnBadge.classList.add('hidden');
      dom.verdictStatusTitle.textContent = 'Stage Concluded';
      dom.verdictStatusDesc.textContent = 'The duel has finished. You may request an Encore (Rematch).';
      dom.verdictStatusIcon.className = 'fa-solid fa-flag-checkered text-fontaine-gold mt-0.5';

    } else if (isMyTurn) {
      dom.selfTurnBadge.classList.remove('hidden');
      dom.selfTurnBadge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/50 animate-pulse';
      dom.selfTurnText.textContent = 'Your Turn';
      dom.opponentTurnBadge.classList.add('hidden');

      dom.verdictStatusTitle.textContent = 'Your Move';
      dom.verdictStatusDesc.textContent = `It is your turn (${myColor === 'w' ? 'White' : 'Black'}). Drag a piece to make your play.`;
      dom.verdictStatusIcon.className = 'fa-solid fa-play text-emerald-400 mt-0.5';

    } else {
      dom.selfTurnBadge.classList.add('hidden');
      dom.opponentTurnBadge.classList.remove('hidden');
      dom.opponentTurnBadge.classList.add('flex');

      dom.verdictStatusTitle.textContent = "Challenger's Turn";
      dom.verdictStatusDesc.textContent = `Waiting for opponent (${opponentColor === 'w' ? 'White' : 'Black'}) to enact their move...`;
      dom.verdictStatusIcon.className = 'fa-solid fa-hourglass-start text-cyan-400 mt-0.5';
    }

    updateCapturedPieces();
    renderMoveHistory();
    updateClockDisplay();
  }

  function updateCapturedPieces() {
    const starting = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };

    const currentCounts = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
    };

    const fenBoard = game.fen().split(' ')[0];
    for (let char of fenBoard) {
      const lower = char.toLowerCase();
      if (['p', 'n', 'b', 'r', 'q'].includes(lower)) {
        const color = char === lower ? 'b' : 'w';
        currentCounts[color][lower]++;
      }
    }

    let whiteCaptures = [];
    let whiteScore = 0;
    let blackCaptures = [];
    let blackScore = 0;

    for (let type of ['q', 'r', 'b', 'n', 'p']) {
      const missingBlack = starting[type] - currentCounts.b[type];
      for (let i = 0; i < missingBlack; i++) {
        whiteCaptures.push(type);
        whiteScore += values[type];
      }

      const missingWhite = starting[type] - currentCounts.w[type];
      for (let i = 0; i < missingWhite; i++) {
        blackCaptures.push(type);
        blackScore += values[type];
      }
    }

    const whiteAdvantage = whiteScore - blackScore;
    const blackAdvantage = blackScore - whiteScore;

    const symbols = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

    const myCaptures = myColor === 'w' ? whiteCaptures : blackCaptures;
    const myAdvantage = myColor === 'w' ? whiteAdvantage : blackAdvantage;

    const oppCaptures = myColor === 'w' ? blackCaptures : whiteCaptures;
    const oppAdvantage = myColor === 'w' ? blackAdvantage : whiteAdvantage;

    dom.selfCapturedPieces.textContent = myCaptures.map(p => symbols[p]).join(' ');
    dom.selfScoreAdvantage.textContent = myAdvantage > 0 ? `+${myAdvantage}` : '';

    dom.opponentCapturedPieces.textContent = oppCaptures.map(p => symbols[p]).join(' ');
    dom.opponentScoreAdvantage.textContent = oppAdvantage > 0 ? `+${oppAdvantage}` : '';
  }

  function renderMoveHistory() {
    const history = game.history();
    if (history.length === 0) {
      dom.emptyMovePlaceholder.classList.remove('hidden');
      dom.moveLogList.innerHTML = '';
      return;
    }

    dom.emptyMovePlaceholder.classList.add('hidden');
    let html = '';

    for (let i = 0; i < history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = history[i];
      const blackMove = history[i + 1] || '';
      const isLatestPair = i + 2 >= history.length;

      html += `
        <div class="flex items-center justify-between px-2.5 py-1 rounded hover:bg-fontaine-900/60 transition text-xs ${
          isLatestPair ? 'bg-cyan-950/40 border border-cyan-500/20' : ''
        }">
          <span class="w-8 text-slate-500 font-bold">${moveNum}.</span>
          <span class="flex-1 font-semibold text-slate-200 tracking-wide">${whiteMove}</span>
          <span class="flex-1 font-semibold text-cyan-300 tracking-wide">${blackMove}</span>
        </div>
      `;
    }

    dom.moveLogList.innerHTML = html;
    dom.moveLogContainer.scrollTop = dom.moveLogContainer.scrollHeight;
  }

  // ==========================================================================
  // 13. WEBRTC & DATA HANDLING (PEERJS)
  // ==========================================================================

  function sendWebRTC(data) {
    if (connection && connection.open) {
      try {
        connection.send(data);
      } catch (e) {
        console.error('WebRTC send error:', e);
      }
    }
  }

  function handleIncomingData(data) {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'init':
        if (data.timePreset) {
          timePreset = data.timePreset;
          whiteTime = data.whiteTime || timePreset.base;
          blackTime = data.blackTime || timePreset.base;
          updateClockDisplay();
        }
        if (data.fen && data.fen !== game.fen()) {
          game.load(data.fen);
          board.position(data.fen);
        }
        break;

      case 'move':
        if (data.whiteTime !== undefined && data.blackTime !== undefined) {
          whiteTime = data.whiteTime;
          blackTime = data.blackTime;
        }

        const move = game.move({
          from: data.from,
          to: data.to,
          promotion: data.promotion || 'q'
        });

        if (move) {
          board.position(game.fen());
          onMoveExecuted(move);
        } else if (data.fen) {
          game.load(data.fen);
          board.position(data.fen);
          updateUI();
          checkGameStatus();
        }
        break;

      case 'takeback_request':
        playSound('droplet');
        dom.takebackModal.classList.remove('hidden');
        dom.takebackModal.classList.add('flex');
        break;

      case 'takeback_response':
        if (data.accepted) {
          executeUndo();
          showToast('Takeback petition granted! The stage rewinds.', 'success');
        } else {
          showToast('Opponent declined your takeback petition.', 'warning');
        }
        break;

      case 'chat':
        appendChatMessage(data.sender, data.text, 'opponent');
        playSound('droplet');
        break;

      case 'draw_offer':
        playSound('check');
        const acceptDraw = confirm('⚖️ Opponent offers a peaceful conclusion (Draw). Accept?');
        const drawResp = { type: 'draw_response', accepted: acceptDraw };
        if (currentMode === 'online') sendWebRTC(drawResp);
        if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(drawResp);

        if (acceptDraw) {
          isGameOver = true;
          stopClock();
          triggerGameOverModal('Draw by Agreement', 'Both sovereigns concluded the duel in peace.', FURINA_QUOTES.draw[0], null);
        }
        break;

      case 'draw_response':
        if (data.accepted) {
          isGameOver = true;
          stopClock();
          triggerGameOverModal('Draw by Agreement', 'Opponent accepted the offer of a draw.', FURINA_QUOTES.draw[0], null);
        } else {
          showToast('Opponent declined the draw offer.', 'warning');
        }
        break;

      case 'resign':
        isGameOver = true;
        stopClock();
        playSound('victory');
        triggerGameOverModal('Victory by Resignation!', 'Opponent conceded the stage to your sovereign authority.', FURINA_QUOTES.checkmateWhite[0], true);
        break;

      case 'rematch_offer':
        playSound('check');
        const acceptRematch = confirm('🎭 Opponent requests an ENCORE (Rematch). Accept?');
        const remResp = { type: 'rematch_response', accepted: acceptRematch };
        if (currentMode === 'online') sendWebRTC(remResp);
        if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(remResp);

        if (acceptRematch) {
          executeRematch();
        }
        break;

      case 'rematch_response':
        if (data.accepted) {
          executeRematch();
          showToast('Rematch accepted! The curtains rise anew.', 'success');
        } else {
          showToast('Opponent declined the rematch offer.', 'warning');
        }
        break;
    }
  }

  // ==========================================================================
  // 14. CONNECTION LIFECYCLES: ONLINE, PASS & PLAY, BLUETOOTH, MULTI-TAB
  // ==========================================================================

  function initHost() {
    isHost = true;
    myColor = 'w';
    opponentColor = 'b';

    dom.hostInitialActions.classList.add('hidden');
    dom.hostLinkBox.classList.remove('hidden');

    updateConnectionPill('connecting', 'Generating Signal...');

    peer = new Peer({ debug: 1 });

    peer.on('open', (id) => {
      myPeerId = id;
      dom.hostPeerBadge.textContent = `ID: ${id.substring(0, 8)}...`;

      const shareUrl = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(id)}`;
      dom.shareLinkInput.value = shareUrl;
      dom.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;

      updateConnectionPill('waiting', 'Awaiting Challenger');
      setFurinaQuote('welcome');
      showToast('Stage initialized! Share your invite link.', 'success');
    });

    peer.on('connection', (incomingConn) => {
      if (connection && connection.open) {
        incomingConn.close();
        return;
      }
      setupConnection(incomingConn);
    });

    peer.on('error', (err) => {
      console.error('PeerJS Host Error:', err);
      updateConnectionPill('disconnected', 'Signal Error');
      showToast(`Connection error: ${err.type || err.message}`, 'error');
    });
  }

  function initJoiner(hostPeerId) {
    isHost = false;
    myColor = 'b';
    opponentColor = 'w';
    targetPeerId = hostPeerId;

    board.orientation('black');

    dom.selfName.textContent = 'You (Challenger)';
    dom.selfColorBadge.textContent = 'Black';
    dom.selfColorBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700';
    dom.selfAvatar.innerHTML = '<i class="fa-solid fa-chess-knight"></i>';

    dom.opponentName.textContent = 'Host (Lady Furina)';
    dom.opponentColorBadge.textContent = 'White';
    dom.opponentColorBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700';
    dom.opponentAvatar.innerHTML = '<i class="fa-solid fa-crown text-fontaine-gold"></i>';

    dom.joinDefaultContent.classList.add('hidden');
    dom.autoJoinState.classList.remove('hidden');
    dom.autoJoinHostText.textContent = `Connecting to Host ID: ${hostPeerId.substring(0, 10)}...`;

    updateConnectionPill('connecting', 'Connecting to Host...');

    peer = new Peer({ debug: 1 });

    peer.on('open', (myId) => {
      myPeerId = myId;
      const conn = peer.connect(hostPeerId, { reliable: true });
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('PeerJS Joiner Error:', err);
      updateConnectionPill('disconnected', 'Connection Failed');
      showToast('Could not establish connection to host.', 'error');
    });
  }

  function setupConnection(conn) {
    connection = conn;

    connection.on('open', () => {
      isConnected = true;
      isGameOver = false;

      updateConnectionPill('connected', 'Stage Active (P2P)');
      dom.lobbySection.classList.add('hidden');

      resetClocks();

      if (isHost) {
        sendWebRTC({
          type: 'init',
          fen: game.fen(),
          hostColor: 'w',
          timePreset: timePreset,
          whiteTime: whiteTime,
          blackTime: blackTime
        });
      }

      playSound('victory');
      setFurinaQuote('gameStart');
      showToast(
        isHost
          ? 'Challenger entered the Opera! You are White (First Move).'
          : 'Connected to Host! You are Black (Host moves first).',
        'success'
      );

      appendChatMessage('Court System', 'WebRTC Data Channel established.', 'system');
      updateUI();
    });

    connection.on('data', handleIncomingData);

    connection.on('close', () => {
      isConnected = false;
      stopClock();
      updateConnectionPill('disconnected', 'Opponent Disconnected');
      playSound('defeat');
      setFurinaQuote('disconnect');
      showToast('Opponent severed connection.', 'error');
      appendChatMessage('Court System', 'Opponent disconnected.', 'system');
      updateUI();
    });

    connection.on('error', (err) => {
      console.error('Connection channel error:', err);
      showToast('P2P connection channel encountered an error.', 'error');
    });
  }

  // --- PASS & PLAY LOCAL MODE ---
  function startOfflinePassPlay() {
    currentMode = 'offline_local';
    isConnected = true;
    isGameOver = false;

    dom.lobbySection.classList.add('hidden');
    updateConnectionPill('connected', 'Local Pass & Play');

    dom.selfName.textContent = 'Player 1 (White)';
    dom.selfColorBadge.textContent = 'White';
    dom.opponentName.textContent = 'Player 2 (Black)';
    dom.opponentColorBadge.textContent = 'Black';

    dom.takebackBtnText.textContent = 'Undo Move';

    resetClocks();
    game.reset();
    board.position('start');
    board.orientation('white');

    playSound('victory');
    setFurinaQuote('gameStart');
    showToast('Local Pass & Play duel commenced!', 'success');
    appendChatMessage('Court System', 'Local 2-Player Pass & Play mode active.', 'system');
    updateUI();
  }

  // --- OFFLINE MULTI-TAB DUAL WINDOW MODE ---
  function initMultiTabOffline(role) {
    currentMode = 'offline_tab';
    isConnected = true;
    isGameOver = false;

    if (!('BroadcastChannel' in window)) {
      showToast('BroadcastChannel not supported in this browser.', 'error');
      return;
    }

    broadcastChan = new BroadcastChannel('fontaine_offline_chess_channel');
    broadcastChan.onmessage = (e) => {
      handleIncomingData(e.data);
    };

    dom.lobbySection.classList.add('hidden');
    updateConnectionPill('connected', `Offline Window (${role === 'w' ? 'White' : 'Black'})`);

    myColor = role;
    opponentColor = role === 'w' ? 'b' : 'w';
    board.orientation(role === 'w' ? 'white' : 'black');

    dom.selfName.textContent = role === 'w' ? 'You (White)' : 'You (Black)';
    dom.selfColorBadge.textContent = role === 'w' ? 'White' : 'Black';
    dom.opponentName.textContent = role === 'w' ? 'Opponent (Black)' : 'Opponent (White)';
    dom.opponentColorBadge.textContent = role === 'w' ? 'Black' : 'White';

    resetClocks();
    game.reset();
    board.position('start');

    if (role === 'w') {
      broadcastChan.postMessage({
        type: 'init',
        fen: game.fen(),
        timePreset: timePreset,
        whiteTime: whiteTime,
        blackTime: blackTime
      });
    }

    playSound('victory');
    setFurinaQuote('gameStart');
    showToast(`Offline Dual-Window started as ${role === 'w' ? 'White' : 'Black'}!`, 'success');
    appendChatMessage('Court System', 'Offline same-device channel active.', 'system');
    updateUI();
  }

  // --- WEB BLUETOOTH CONNECTIVITY ---
  function checkBluetoothSupport() {
    if ('bluetooth' in navigator) {
      dom.bluetoothSupportBadge.textContent = 'Supported';
      dom.bluetoothSupportBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/50';
      dom.bluetoothDesc.textContent = 'Web Bluetooth API is available. Click below to pair with a Bluetooth LE device or peripheral.';
    } else {
      dom.bluetoothSupportBadge.textContent = 'Not Supported';
      dom.bluetoothSupportBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/50';
      dom.bluetoothDesc.textContent = 'Web Bluetooth is not supported in this browser engine. Use Chrome, Edge, or Opera on Windows 10/11, macOS, or Android.';
    }
  }

  async function requestBluetoothConnection() {
    if (!('bluetooth' in navigator)) {
      showToast('Web Bluetooth API is not supported in this browser.', 'error');
      return;
    }

    try {
      showToast('Opening Bluetooth scan dialogue...', 'info');
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true
      });

      if (bluetoothDevice) {
        showToast(`Paired with Bluetooth Device: ${bluetoothDevice.name || 'Unknown'}`, 'success');
        updateConnectionPill('connected', `BT: ${bluetoothDevice.name || 'Device'}`);
        dom.lobbySection.classList.add('hidden');
        isConnected = true;
        updateUI();
      }
    } catch (e) {
      if (e.name !== 'NotFoundError') {
        console.error('Bluetooth error:', e);
        showToast(`Bluetooth pairing cancelled or failed: ${e.message}`, 'warning');
      }
    }
  }

  function updateConnectionPill(status, text) {
    dom.connectionPillText.textContent = text;
    dom.connectionPill.className =
      'shrink-0 flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ' +
      (status === 'connected'
        ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
        : status === 'waiting'
        ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-300'
        : status === 'connecting'
        ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300'
        : 'bg-rose-950/80 border border-rose-500/50 text-rose-300');

    const dot = dom.connectionPill.querySelector('span:first-child');
    if (dot) {
      dot.className =
        'w-2 h-2 rounded-full ' +
        (status === 'connected'
          ? 'bg-emerald-400'
          : status === 'waiting'
          ? 'bg-cyan-400 animate-ping'
          : status === 'connecting'
          ? 'bg-amber-400 animate-ping'
          : 'bg-rose-400');
    }
  }

  // ==========================================================================
  // 15. CHAT & REMATCH
  // ==========================================================================

  function appendChatMessage(sender, text, type = 'opponent') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');

    if (type === 'self') {
      bubble.className = 'chat-bubble-self p-2.5 max-w-[85%] ml-auto text-cyan-100 shadow-sm';
      bubble.innerHTML = `
        <div class="flex items-center justify-between gap-3 text-[10px] text-cyan-300 font-semibold mb-0.5">
          <span>You</span>
          <span class="text-slate-400 text-[9px]">${time}</span>
        </div>
        <p class="text-xs break-words">${escapeHTML(text)}</p>
      `;
    } else if (type === 'opponent') {
      bubble.className = 'chat-bubble-opponent p-2.5 max-w-[85%] mr-auto text-slate-200 shadow-sm';
      bubble.innerHTML = `
        <div class="flex items-center justify-between gap-3 text-[10px] text-fontaine-gold font-semibold mb-0.5">
          <span>${escapeHTML(sender)}</span>
          <span class="text-slate-400 text-[9px]">${time}</span>
        </div>
        <p class="text-xs break-words">${escapeHTML(text)}</p>
      `;
    } else {
      bubble.className = 'chat-bubble-system p-2 text-center text-[10.5px] text-fontaine-gold italic';
      bubble.textContent = text;
    }

    dom.chatMessages.appendChild(bubble);
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  }

  function handleSendChat(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    if (!isConnected) {
      showToast('Connect with an opponent to send messages!', 'warning');
      return;
    }

    const senderName = isHost ? 'Furina (White)' : 'Challenger (Black)';
    const packet = { type: 'chat', sender: senderName, text: cleanText };

    if (currentMode === 'online') sendWebRTC(packet);
    if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);

    appendChatMessage('You', cleanText, 'self');
    playSound('droplet');
    dom.chatInput.value = '';
  }

  function executeRematch() {
    closeGameOverModal();
    game.reset();

    if (currentMode !== 'offline_local') {
      myColor = myColor === 'w' ? 'b' : 'w';
      opponentColor = myColor === 'w' ? 'b' : 'w';
    }

    board.orientation(myColor === 'w' ? 'white' : 'black');
    board.position('start');

    isGameOver = false;
    lastMoveSquares = { from: null, to: null };
    removeSquareHighlights();

    resetClocks();
    updateUI();
    setFurinaQuote('gameStart');
    playSound('victory');
    showToast('Rematch started! The stage is renewed.', 'success');
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // ==========================================================================
  // 16. EVENT BINDINGS
  // ==========================================================================

  function bindEvents() {
    // Mode Switcher Tabs
    dom.modeTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        dom.modeTabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mode = e.currentTarget.getAttribute('data-mode');
        switchGameMode(mode);
      });
    });

    // Time Control Presets
    dom.timerButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        dom.timerButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const base = parseInt(e.currentTarget.getAttribute('data-time'), 10);
        const inc = parseInt(e.currentTarget.getAttribute('data-inc'), 10);
        timePreset = { base, inc };
        resetClocks();
        showToast(`Timer set: ${base === 0 ? 'No Clock' : formatTime(base) + (inc ? ' +' + inc + 's' : '')}`, 'info');
      });
    });

    // Host Button
    dom.createGameBtn.addEventListener('click', () => initHost());

    // Copy Link Button
    dom.copyLinkBtn.addEventListener('click', () => {
      const shareUrl = dom.shareLinkInput.value;
      if (!shareUrl || shareUrl.startsWith('Generating')) return;

      navigator.clipboard.writeText(shareUrl).then(() => {
        dom.copyIcon.className = 'fa-solid fa-check text-emerald-400';
        dom.copyBtnText.textContent = 'Copied!';
        showToast('Stage invitation link copied!', 'success');
        playSound('droplet');

        setTimeout(() => {
          dom.copyIcon.className = 'fa-solid fa-copy';
          dom.copyBtnText.textContent = 'Copy Link';
        }, 2500);
      }).catch(() => {
        dom.shareLinkInput.select();
        document.execCommand('copy');
        showToast('Link copied to clipboard!', 'success');
      });
    });

    // Manual Join Button
    dom.manualJoinBtn.addEventListener('click', () => {
      let val = dom.manualJoinInput.value.trim();
      if (!val) return;
      if (val.includes('?join=')) {
        try {
          const url = new URL(val);
          val = url.searchParams.get('join') || val;
        } catch (e) {
          const match = val.match(/\?join=([^&#]+)/);
          if (match) val = match[1];
        }
      }
      initJoiner(val);
    });

    dom.cancelJoinBtn.addEventListener('click', () => {
      window.location.href = window.location.origin + window.location.pathname;
    });

    // QR Modal
    dom.showQrBtn.addEventListener('click', () => {
      dom.qrModal.classList.remove('hidden');
      dom.qrModal.classList.add('flex');
    });
    dom.closeQrModalBtn.addEventListener('click', () => {
      dom.qrModal.classList.add('hidden');
      dom.qrModal.classList.remove('flex');
    });

    // Offline & Bluetooth Buttons
    dom.startPassPlayBtn.addEventListener('click', () => startOfflinePassPlay());
    dom.autoFlipToggle.addEventListener('change', (e) => {
      autoFlipEnabled = e.target.checked;
    });

    dom.scanBluetoothBtn.addEventListener('click', () => requestBluetoothConnection());
    dom.startBtSimulationBtn.addEventListener('click', () => startOfflinePassPlay());

    dom.startBroadcastWhiteBtn.addEventListener('click', () => initMultiTabOffline('w'));
    dom.startBroadcastBlackBtn.addEventListener('click', () => initMultiTabOffline('b'));

    // In-game Utilities
    dom.takebackBtn.addEventListener('click', () => handleTakebackRequest());
    dom.flipBoardBtn.addEventListener('click', () => {
      board.flip();
      reapplyLastMoveHighlights();
    });

    dom.fenCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(game.fen()).then(() => {
        showToast('FEN notation copied to clipboard!', 'success');
        playSound('droplet');
      });
    });

    dom.offerDrawBtn.addEventListener('click', () => {
      if (!isConnected || isGameOver) return;
      if (confirm('Offer a draw to your opponent?')) {
        const packet = { type: 'draw_offer' };
        if (currentMode === 'online') sendWebRTC(packet);
        if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);
        showToast('Draw offer transmitted.', 'info');
      }
    });

    dom.resignBtn.addEventListener('click', () => {
      if (!isConnected || isGameOver) return;
      if (confirm('Are you certain you wish to concede the stage (Resign)?')) {
        const packet = { type: 'resign', player: myColor };
        if (currentMode === 'online') sendWebRTC(packet);
        if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);

        isGameOver = true;
        stopClock();
        playSound('defeat');
        triggerGameOverModal('You Have Conceded', 'You surrendered the stage.', FURINA_QUOTES.checkmateBlack[1], false);
      }
    });

    dom.navNewGameBtn.addEventListener('click', () => {
      if (confirm('Start a new duel session? This resets the current board.')) {
        window.location.href = window.location.origin + window.location.pathname;
      }
    });

    // Takeback Modal Handlers
    dom.acceptTakebackBtn.addEventListener('click', () => {
      dom.takebackModal.classList.add('hidden');
      dom.takebackModal.classList.remove('flex');

      const packet = { type: 'takeback_response', accepted: true };
      if (currentMode === 'online') sendWebRTC(packet);
      if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);

      executeUndo();
      showToast('Takeback granted.', 'success');
    });

    dom.declineTakebackBtn.addEventListener('click', () => {
      dom.takebackModal.classList.add('hidden');
      dom.takebackModal.classList.remove('flex');

      const packet = { type: 'takeback_response', accepted: false };
      if (currentMode === 'online') sendWebRTC(packet);
      if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);

      showToast('Takeback petition declined.', 'info');
    });

    // Rematch
    dom.rematchBtn.addEventListener('click', () => {
      if (currentMode === 'offline_local') {
        executeRematch();
        return;
      }
      if (!isConnected) {
        showToast('Opponent is not connected.', 'warning');
        return;
      }
      const packet = { type: 'rematch_offer' };
      if (currentMode === 'online') sendWebRTC(packet);
      if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);
      showToast('Encore requested! Awaiting opponent...', 'info');
    });

    dom.closeGameOverModalBtn.addEventListener('click', closeGameOverModal);

    // Promotion Buttons
    document.querySelectorAll('.promotion-piece-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const piece = e.currentTarget.getAttribute('data-piece');
        selectPromotionPiece(piece);
      });
    });

    // Audio & Sound Controls
    dom.bgMusicToggleBtn.addEventListener('click', () => toggleBackgroundMusic());
    dom.modalMusicToggleBtn.addEventListener('click', () => toggleBackgroundMusic());

    dom.soundSettingsBtn.addEventListener('click', () => {
      dom.soundSettingsModal.classList.remove('hidden');
      dom.soundSettingsModal.classList.add('flex');
    });
    dom.closeSoundSettingsBtn.addEventListener('click', () => {
      dom.soundSettingsModal.classList.add('hidden');
      dom.soundSettingsModal.classList.remove('flex');
    });
    dom.dismissSoundSettingsBtn.addEventListener('click', () => {
      dom.soundSettingsModal.classList.add('hidden');
      dom.soundSettingsModal.classList.remove('flex');
    });

    dom.soundStyleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        dom.soundStyleButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        soundStyle = e.currentTarget.getAttribute('data-style');
        playSound('move');
        showToast(`Sound style set to: ${soundStyle.toUpperCase()}`, 'info');
      });
    });

    dom.sfxVolumeSlider.addEventListener('input', (e) => {
      soundVolume = parseInt(e.target.value, 10) / 100;
      dom.sfxVolumeLabel.textContent = `${e.target.value}%`;
    });

    dom.musicVolumeSlider.addEventListener('input', (e) => {
      musicVolume = parseInt(e.target.value, 10) / 100;
    });

    // Help Modal
    dom.helpModalBtn.addEventListener('click', () => {
      dom.helpModal.classList.remove('hidden');
      dom.helpModal.classList.add('flex');
    });
    dom.closeHelpModalBtn.addEventListener('click', () => {
      dom.helpModal.classList.add('hidden');
      dom.helpModal.classList.remove('flex');
    });
    dom.dismissHelpBtn.addEventListener('click', () => {
      dom.helpModal.classList.add('hidden');
      dom.helpModal.classList.remove('flex');
    });

    // Chat
    dom.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendChat(dom.chatInput.value);
    });

    document.querySelectorAll('.chat-emote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        handleSendChat(text);
      });
    });
  }

  function switchGameMode(mode) {
    currentMode = mode;
    dom.onlineLobbyGrid.classList.add('hidden');
    dom.offlinePassPlayLobby.classList.add('hidden');
    dom.bluetoothLobby.classList.add('hidden');
    dom.offlineMultiTabLobby.classList.add('hidden');

    if (mode === 'online') {
      dom.onlineLobbyGrid.classList.remove('hidden');
      dom.activeModeBadgeText.textContent = 'Mode: Online P2P';
      updateConnectionPill('waiting', 'Stage Ready to Host');
    } else if (mode === 'offline_local') {
      dom.offlinePassPlayLobby.classList.remove('hidden');
      dom.activeModeBadgeText.textContent = 'Mode: Pass & Play';
      updateConnectionPill('waiting', 'Local Offline Ready');
    } else if (mode === 'bluetooth') {
      dom.bluetoothLobby.classList.remove('hidden');
      dom.activeModeBadgeText.textContent = 'Mode: Bluetooth Duel';
      checkBluetoothSupport();
      updateConnectionPill('waiting', 'Bluetooth Scanner Ready');
    } else if (mode === 'offline_tab') {
      dom.offlineMultiTabLobby.classList.remove('hidden');
      dom.activeModeBadgeText.textContent = 'Mode: Dual Window';
      updateConnectionPill('waiting', 'Multi-Tab Offline Ready');
    }
  }

  // ==========================================================================
  // 17. APP INITIALIZATION
  // ==========================================================================

  function initApp() {
    initChess();
    bindEvents();
    setFurinaQuote('welcome');
    resetClocks();

    const urlParams = new URLSearchParams(window.location.search);
    const joinId = urlParams.get('join');

    if (joinId && joinId.trim() !== '') {
      initJoiner(joinId.trim());
    } else {
      isHost = true;
      myColor = 'w';
      opponentColor = 'b';
      board.orientation('white');
      updateConnectionPill('waiting', 'Stage Ready to Host');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
