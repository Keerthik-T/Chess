/**
 * ============================================================================
 * OPÉRA ÉPICLESSE — MINIMALIST CHESS (FURINA ACCENTS)
 * Serverless P2P, Offline Pass & Play, Bluetooth & Multi-Tab Chess
 * ============================================================================
 */

(() => {
  'use strict';

  // ==========================================================================
  // 1. CONFIGURATION & STATE
  // ==========================================================================

  // Robust STUN & TURN servers for WebRTC connection across firewalls, symmetric NATs and mobile networks
  const PEER_CONFIG = {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:relay.metered.ca:80' },
        {
          urls: 'turn:global.relay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:global.relay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:global.relay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10
    }
  };

  let game = null;           // chess.js instance
  let board = null;          // chessboard.js instance
  let peer = null;           // PeerJS instance
  let connection = null;     // PeerJS DataConnection
  let broadcastChan = null;  // BroadcastChannel for offline dual window
  let bluetoothDevice = null;// Web Bluetooth peripheral device
  let heartbeatInterval = null;
  let connectionTimeout = null;
  let connectionWatchdog = null;

  let myPeerId = null;
  let targetPeerId = null;

  // Game Modes: 'online' | 'offline_local' | 'bluetooth' | 'offline_tab'
  let currentMode = 'online';

  // Colors: 'w' (White) | 'b' (Black)
  let myColor = 'w';
  let opponentColor = 'b';
  let isHost = true;
  let isConnected = false;
  let isGameOver = false;

  // Offline Pass & Play Settings
  let autoFlipEnabled = true;

  // Chess Clocks / Blitz Timers
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

  // Board & Visual Preferences
  let currentTheme = 'fontaine';
  let animSpeedDuration = 230; // ms
  let showLegalDots = true;
  let showCoordinates = true;

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
      '"The spotlight falls upon you. Command the stage with elegance."',
      '"Take your time, yet do not keep the audience waiting too long."'
    ],
    opponentTurn: [
      '"Mademoiselle Crabaletta watches the opponent with intense scrutiny..."',
      '"The opposing sovereign ponders their next manoeuvre in the shadows."'
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

  // Board Theme Palettes
  const BOARD_THEMES = {
    fontaine: { light: '#ebecd0', dark: '#2c4d6f', name: 'Fontaine Slate' },
    green: { light: '#ebecd0', dark: '#739552', name: 'Classic Green' },
    obsidian: { light: '#e5e7eb', dark: '#374151', name: 'Obsidian Charcoal' },
    ocean: { light: '#dbeafe', dark: '#1e3a8a', name: 'Royal Azure' }
  };

  // ==========================================================================
  // 2. DOM REFERENCES
  // ==========================================================================

  const dom = {
    connectionPill: document.getElementById('connectionPill'),
    connectionPillText: document.getElementById('connectionPillText'),
    bgMusicToggleBtn: document.getElementById('bgMusicToggleBtn'),
    bgMusicIcon: document.getElementById('bgMusicIcon'),
    bgMusicLabel: document.getElementById('bgMusicLabel'),
    soundSettingsBtn: document.getElementById('soundSettingsBtn'),
    helpModalBtn: document.getElementById('helpModalBtn'),
    navNewGameBtn: document.getElementById('navNewGameBtn'),

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
    selfCapturedPieces: document.getElementById('selfCapturedPieces'),
    selfScoreAdvantage: document.getElementById('selfScoreAdvantage'),
    selfClockTime: document.getElementById('selfClockTime'),
    selfClockWrapper: document.getElementById('selfClockWrapper'),

    sidebarTabs: document.querySelectorAll('.sidebar-tab-btn'),
    sidebarTabContents: document.querySelectorAll('.sidebar-tab-content'),

    modeTabs: document.querySelectorAll('.mode-tab-btn'),
    panelOnline: document.getElementById('panel-online'),
    panelOfflineLocal: document.getElementById('panel-offline_local'),
    panelBluetooth: document.getElementById('panel-bluetooth'),
    panelOfflineTab: document.getElementById('panel-offline_tab'),

    timerButtons: document.querySelectorAll('.timer-select-btn'),

    createGameBtn: document.getElementById('createGameBtn'),
    hostLinkBox: document.getElementById('hostLinkBox'),
    hostPeerBadge: document.getElementById('hostPeerBadge'),
    shareLinkInput: document.getElementById('shareLinkInput'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    copyIcon: document.getElementById('copyIcon'),
    copyBtnText: document.getElementById('copyBtnText'),
    showQrBtn: document.getElementById('showQrBtn'),
    hostStatusMsg: document.getElementById('hostStatusMsg'),
    hostStatusMsgText: document.getElementById('hostStatusMsgText'),

    joinDefaultContent: document.getElementById('joinDefaultContent'),
    manualJoinInput: document.getElementById('manualJoinInput'),
    manualJoinBtn: document.getElementById('manualJoinBtn'),
    autoJoinState: document.getElementById('autoJoinState'),
    autoJoinSpinner: document.getElementById('autoJoinSpinner'),
    autoJoinStatusTitle: document.getElementById('autoJoinStatusTitle'),
    autoJoinHostText: document.getElementById('autoJoinHostText'),
    autoJoinDiagnosticMsg: document.getElementById('autoJoinDiagnosticMsg'),
    retryJoinBtn: document.getElementById('retryJoinBtn'),
    cancelJoinBtn: document.getElementById('cancelJoinBtn'),

    autoFlipToggle: document.getElementById('autoFlipToggle'),
    startPassPlayBtn: document.getElementById('startPassPlayBtn'),
    bluetoothSupportBadge: document.getElementById('bluetoothSupportBadge'),
    bluetoothDesc: document.getElementById('bluetoothDesc'),
    scanBluetoothBtn: document.getElementById('scanBluetoothBtn'),
    startBtSimulationBtn: document.getElementById('startBtSimulationBtn'),
    startBroadcastWhiteBtn: document.getElementById('startBroadcastWhiteBtn'),
    startBroadcastBlackBtn: document.getElementById('startBroadcastBlackBtn'),

    verdictStatusTitle: document.getElementById('verdictStatusTitle'),
    verdictStatusDesc: document.getElementById('verdictStatusDesc'),
    furinaQuoteText: document.getElementById('furinaQuoteText'),
    moveCountBadge: document.getElementById('moveCountBadge'),

    moveLogContainer: document.getElementById('moveLogContainer'),
    emptyMovePlaceholder: document.getElementById('emptyMovePlaceholder'),
    moveLogList: document.getElementById('moveLogList'),

    chatMessages: document.getElementById('chatMessages'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),

    activeThemeLabel: document.getElementById('activeThemeLabel'),
    boardThemeSwatches: document.querySelectorAll('.board-theme-swatch'),
    animSpeedButtons: document.querySelectorAll('.anim-speed-btn'),
    toggleLegalDots: document.getElementById('toggleLegalDots'),
    toggleCoords: document.getElementById('toggleCoords'),
    testSoundBtn: document.getElementById('testSoundBtn'),
    soundStyleButtons: document.querySelectorAll('.sound-style-btn'),
    sfxVolumeSlider: document.getElementById('sfxVolumeSlider'),
    sfxVolumeLabel: document.getElementById('sfxVolumeLabel'),
    modalMusicToggleBtn: document.getElementById('modalMusicToggleBtn'),
    musicVolumeSlider: document.getElementById('musicVolumeSlider'),
    musicVolumeLabel: document.getElementById('musicVolumeLabel'),
    settingsPeerIdInput: document.getElementById('settingsPeerIdInput'),
    settingsCopyPeerIdBtn: document.getElementById('settingsCopyPeerIdBtn'),
    resetSettingsBtn: document.getElementById('resetSettingsBtn'),

    takebackBtn: document.getElementById('takebackBtn'),
    takebackBtnText: document.getElementById('takebackBtnText'),
    offerDrawBtn: document.getElementById('offerDrawBtn'),
    resignBtn: document.getElementById('resignBtn'),
    flipBoardBtn: document.getElementById('flipBoardBtn'),
    fenCopyBtn: document.getElementById('fenCopyBtn'),

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

    helpModal: document.getElementById('helpModal'),
    closeHelpModalBtn: document.getElementById('closeHelpModalBtn'),
    dismissHelpBtn: document.getElementById('dismissHelpBtn'),

    toastContainer: document.getElementById('toastContainer')
  };

  // ==========================================================================
  // 3. UTILITY FUNCTIONS
  // ==========================================================================

  // Extracts clean Peer ID from raw text, full URL, or query string
  function extractPeerId(input) {
    if (!input) return '';
    let str = input.trim();
    try {
      if (str.includes('?join=')) {
        const url = new URL(str, window.location.origin);
        return url.searchParams.get('join') || str;
      }
    } catch (e) {
      const match = str.match(/[?&]join=([^&#\s]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return str;
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `p-2.5 px-3 rounded-lg shadow-xl border backdrop-blur-md flex items-center gap-2 text-xs font-medium tracking-wide animate-scale-up pointer-events-auto ${
      type === 'success'
        ? 'bg-surface-900 text-hydro-300 border-hydro-500/40'
        : type === 'warning'
        ? 'bg-surface-900 text-amber-300 border-amber-500/40'
        : type === 'error'
        ? 'bg-surface-900 text-rose-300 border-rose-500/40'
        : 'bg-surface-900 text-slate-200 border-white/10'
    }`;

    const icon =
      type === 'success' ? 'fa-circle-check text-hydro-400' :
      type === 'warning' ? 'fa-triangle-exclamation text-amber-400' :
      type === 'error' ? 'fa-circle-xmark text-rose-400' : 'fa-circle-info text-slate-400';

    toast.innerHTML = `<i class="fa-solid ${icon} text-xs shrink-0"></i><span>${message}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function setFurinaQuote(category) {
    const quotes = FURINA_QUOTES[category] || FURINA_QUOTES.welcome;
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    dom.furinaQuoteText.textContent = randomQuote;
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
  // 4. WEBRTC ENGINE (PEERJS WITH STUN, TURN RELAY & WATCHDOG)
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

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
      if (connection && connection.open) {
        sendWebRTC({ type: 'ping' });
      }
    }, 4000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  function clearConnectionTimers() {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
    if (connectionWatchdog) {
      clearTimeout(connectionWatchdog);
      connectionWatchdog = null;
    }
  }

  function setupConnection(conn) {
    if (!conn) return;
    connection = conn;

    // Attach WebRTC PeerConnection ICE diagnostics if accessible
    try {
      const pc = conn.peerConnection || conn._peerConnection;
      if (pc) {
        pc.addEventListener('iceconnectionstatechange', () => {
          const state = pc.iceConnectionState;
          console.log('RTCPeerConnection ICE state:', state);
          if (state === 'checking') {
            updateConnectionPill('connecting', 'P2P Handshake...');
          } else if (state === 'connected' || state === 'completed') {
            if (!isConnected) onOpen();
          } else if (state === 'failed') {
            console.warn('ICE connection failed, triggering restart...');
            if (typeof pc.restartIce === 'function') {
              pc.restartIce();
            }
          }
        });
      }
    } catch (e) {
      console.warn('ICE listener setup notice:', e);
    }

    let hasOpened = false;
    function onOpen() {
      if (hasOpened) return;
      hasOpened = true;

      clearConnectionTimers();

      console.log('WebRTC connection ready with peer:', conn.peer);
      isConnected = true;
      isGameOver = false;

      updateConnectionPill('connected', 'Live (P2P)');
      resetClocks();

      // Automatically switch to Moves tab
      switchSidebarTab('tab-moves');

      // Update status text
      if (dom.hostStatusMsgText) {
        dom.hostStatusMsgText.textContent = 'Opponent connected! Duel in progress.';
      }
      if (dom.autoJoinDiagnosticMsg) {
        dom.autoJoinDiagnosticMsg.classList.add('hidden');
      }

      // Host initiates synchronization
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
        isHost ? 'Challenger connected! White moves first.' : 'Connected to host! White moves first.',
        'success'
      );

      appendChatMessage('System', 'P2P WebRTC data connection established.', 'system');
      updateUI();
      startHeartbeat();
    }

    // CRITICAL: Handle if connection is already open OR await event
    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('data', (data) => {
      if (data && data.type === 'ping') {
        sendWebRTC({ type: 'pong' });
        return;
      }
      if (data && data.type === 'pong') {
        return; // Heartbeat acknowledged
      }
      handleIncomingData(data);
    });

    conn.on('close', () => {
      console.log('Connection closed with peer:', conn.peer);
      clearConnectionTimers();
      isConnected = false;
      stopClock();
      stopHeartbeat();
      updateConnectionPill('disconnected', 'Disconnected');
      playSound('defeat');
      setFurinaQuote('disconnect');
      showToast('Opponent disconnected.', 'error');
      appendChatMessage('System', 'Opponent disconnected.', 'system');
      updateUI();
    });

    conn.on('error', (err) => {
      console.error('DataConnection error:', err);
      clearConnectionTimers();
      showToast(`Connection error: ${err.message || err}`, 'error');
    });
  }

  function initHost(regenerate = false) {
    isHost = true;
    myColor = 'w';
    opponentColor = 'b';
    board.orientation('white');
    clearConnectionTimers();

    if (peer && !peer.destroyed && !regenerate) {
      return;
    }

    updateConnectionPill('connecting', 'Generating Signal...');

    if (peer && !peer.destroyed) {
      peer.destroy();
    }

    try {
      peer = new Peer(PEER_CONFIG);
    } catch (e) {
      console.error('Failed to create Peer with custom config, falling back to default:', e);
      peer = new Peer();
    }

    peer.on('open', (id) => {
      myPeerId = id;
      console.log('Host PeerJS ready with ID:', id);

      const shareUrl = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(id)}`;
      dom.shareLinkInput.value = shareUrl;
      dom.settingsPeerIdInput.value = id;

      if (dom.hostPeerBadge) {
        dom.hostPeerBadge.textContent = `ID: ${id.substring(0, 8)}...`;
      }

      dom.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;

      updateConnectionPill('waiting', 'Ready for Opponent');
      setFurinaQuote('welcome');

      if (dom.hostStatusMsgText) {
        dom.hostStatusMsgText.textContent = 'Waiting for opponent to open link...';
      }
    });

    peer.on('connection', (incomingConn) => {
      console.log('Incoming connection request from peer:', incomingConn.peer);
      if (connection && connection.open) {
        incomingConn.close();
        return;
      }
      setupConnection(incomingConn);
    });

    peer.on('disconnected', () => {
      console.warn('Host disconnected from signaling server. Reconnecting...');
      if (peer && !peer.destroyed) {
        peer.reconnect();
      }
    });

    peer.on('error', (err) => {
      console.error('Host Peer Error:', err);
      updateConnectionPill('disconnected', 'Signal Error');
      showToast(`Peer signal error: ${err.type || err.message}`, 'error');
    });
  }

  function initJoiner(hostPeerId) {
    const cleanHostId = extractPeerId(hostPeerId);
    if (!cleanHostId) {
      showToast('Invalid host connection ID.', 'error');
      return;
    }

    clearConnectionTimers();

    isHost = false;
    myColor = 'b';
    opponentColor = 'w';
    targetPeerId = cleanHostId;

    board.orientation('black');

    dom.selfName.textContent = 'You (Black)';
    dom.selfColorBadge.textContent = 'Black';
    dom.selfAvatar.innerHTML = '<i class="fa-solid fa-chess-knight"></i>';

    dom.opponentName.textContent = 'Host (White)';
    dom.opponentColorBadge.textContent = 'White';
    dom.opponentAvatar.innerHTML = '<i class="fa-solid fa-crown text-gold-400"></i>';

    dom.joinDefaultContent.classList.add('hidden');
    dom.autoJoinState.classList.remove('hidden');
    dom.autoJoinHostText.textContent = `Host ID: ${cleanHostId.substring(0, 16)}...`;
    if (dom.autoJoinDiagnosticMsg) {
      dom.autoJoinDiagnosticMsg.classList.add('hidden');
      dom.autoJoinDiagnosticMsg.textContent = '';
    }
    if (dom.autoJoinStatusTitle) {
      dom.autoJoinStatusTitle.textContent = 'Connecting to Host Stage...';
    }

    updateConnectionPill('connecting', 'Connecting...');
    showToast(`Connecting to Host Stage...`, 'info');

    // Connection watchdog at 5 seconds and timeout at 12 seconds
    connectionWatchdog = setTimeout(() => {
      if (!isConnected) {
        updateConnectionPill('connecting', 'Negotiating route...');
        if (dom.autoJoinDiagnosticMsg) {
          dom.autoJoinDiagnosticMsg.textContent = 'Traversing NAT / firewall... attempting TURN relay connection.';
          dom.autoJoinDiagnosticMsg.classList.remove('hidden');
        }
      }
    }, 5000);

    connectionTimeout = setTimeout(() => {
      if (!isConnected) {
        updateConnectionPill('disconnected', 'Connection Stalled');
        if (dom.autoJoinDiagnosticMsg) {
          dom.autoJoinDiagnosticMsg.textContent = 'Connection taking longer than usual. Ensure the host has this page open and their screen is active.';
          dom.autoJoinDiagnosticMsg.classList.remove('hidden');
        }
        if (dom.autoJoinStatusTitle) {
          dom.autoJoinStatusTitle.textContent = 'Connection Stalled';
        }
        showToast('Connection stalled. Tap Retry or check with Host.', 'warning');
      }
    }, 12000);

    if (peer && !peer.destroyed) {
      peer.destroy();
    }

    try {
      peer = new Peer(PEER_CONFIG);
    } catch (e) {
      console.error('Failed to create Peer with custom config, falling back to default:', e);
      peer = new Peer();
    }

    peer.on('open', (myId) => {
      myPeerId = myId;
      dom.settingsPeerIdInput.value = myId;
      console.log('Joiner PeerJS ready with ID:', myId, 'Connecting to host:', cleanHostId);

      if (dom.autoJoinStatusTitle) {
        dom.autoJoinStatusTitle.textContent = 'Host Contacted! Opening channel...';
      }

      const conn = peer.connect(cleanHostId, {
        reliable: true
      });
      setupConnection(conn);
    });

    peer.on('disconnected', () => {
      console.warn('Joiner disconnected from signaling server. Reconnecting...');
      if (peer && !peer.destroyed) {
        peer.reconnect();
      }
    });

    peer.on('error', (err) => {
      clearConnectionTimers();
      console.error('Joiner Peer Error:', err);
      updateConnectionPill('disconnected', 'Connection Failed');
      if (dom.autoJoinStatusTitle) {
        dom.autoJoinStatusTitle.textContent = 'Connection Failed';
      }
      if (err.type === 'peer-unavailable') {
        if (dom.autoJoinDiagnosticMsg) {
          dom.autoJoinDiagnosticMsg.textContent = 'Host not found. The host may have refreshed their page or the invite link expired.';
          dom.autoJoinDiagnosticMsg.classList.remove('hidden');
        }
        showToast('Host not found. Ask Host for their newest invite link.', 'error');
      } else {
        if (dom.autoJoinDiagnosticMsg) {
          dom.autoJoinDiagnosticMsg.textContent = `Signaling error (${err.type || err.message}). Tap Retry to reconnect.`;
          dom.autoJoinDiagnosticMsg.classList.remove('hidden');
        }
        showToast(`Connection error: ${err.type || err.message}`, 'error');
      }
    });
  }

  function updateConnectionPill(status, text) {
    dom.connectionPillText.textContent = text;
    const dot = dom.connectionPill.querySelector('span:first-child');
    if (dot) {
      dot.className =
        'w-1.5 h-1.5 rounded-full ' +
        (status === 'connected' ? 'bg-emerald-400' :
         status === 'waiting' ? 'bg-hydro-400 animate-ping' :
         status === 'connecting' ? 'bg-amber-400 animate-ping' : 'bg-rose-400');
    }
  }

  // ==========================================================================
  // 5. INCOMING DATA HANDLING & CHESS PLAY
  // ==========================================================================

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
          board.position(data.fen, true);
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
          // Physical piece glide across squares!
          board.position(game.fen(), true);
          onMoveExecuted(move);
        } else if (data.fen) {
          game.load(data.fen);
          board.position(data.fen, true);
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
          showToast('Takeback granted! Move rewound.', 'success');
        } else {
          showToast('Opponent declined takeback.', 'warning');
        }
        break;

      case 'chat':
        appendChatMessage(data.sender, data.text, 'opponent');
        playSound('droplet');
        break;

      case 'draw_offer':
        playSound('check');
        const acceptDraw = confirm('Opponent offers a draw. Accept?');
        const drawResp = { type: 'draw_response', accepted: acceptDraw };
        if (currentMode === 'online') sendWebRTC(drawResp);
        if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(drawResp);

        if (acceptDraw) {
          isGameOver = true;
          stopClock();
          triggerGameOverModal('Draw Agreed', 'Both players agreed to a draw.', FURINA_QUOTES.draw[0], null);
        }
        break;

      case 'draw_response':
        if (data.accepted) {
          isGameOver = true;
          stopClock();
          triggerGameOverModal('Draw Agreed', 'Opponent accepted the draw.', FURINA_QUOTES.draw[0], null);
        } else {
          showToast('Draw offer declined.', 'warning');
        }
        break;

      case 'resign':
        isGameOver = true;
        stopClock();
        playSound('victory');
        triggerGameOverModal('Victory by Resignation!', 'Opponent resigned.', FURINA_QUOTES.checkmateWhite[0], true);
        break;

      case 'rematch_offer':
        playSound('check');
        const acceptRematch = confirm('Opponent requests a rematch. Accept?');
        const remResp = { type: 'rematch_response', accepted: acceptRematch };
        if (currentMode === 'online') sendWebRTC(remResp);
        if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(remResp);

        if (acceptRematch) executeRematch();
        break;

      case 'rematch_response':
        if (data.accepted) {
          executeRematch();
          showToast('Rematch accepted!', 'success');
        } else {
          showToast('Rematch declined.', 'warning');
        }
        break;
    }
  }

  // ==========================================================================
  // 6. CHESS ENGINE & BOARD
  // ==========================================================================

  function initChess() {
    game = new Chess();

    const config = {
      draggable: true,
      position: 'start',
      orientation: myColor === 'w' ? 'white' : 'black',
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
      moveSpeed: animSpeedDuration,
      snapbackSpeed: 150,
      snapSpeed: 70,
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

  function handleDragStart(source, piece, position, orientation) {
    if (game.game_over() || isGameOver) return false;

    if (currentMode === 'offline_local') {
      const turn = game.turn();
      if ((turn === 'w' && piece.search(/^b/) !== -1) || (turn === 'b' && piece.search(/^w/) !== -1)) {
        return false;
      }
      highlightLegalMoves(source);
      return true;
    }

    if (!isConnected) {
      showToast('Connect with opponent to start playing!', 'warning');
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
    broadcastMove(move);
  }

  function handleSnapEnd() {
    board.position(game.fen(), false);
    reapplyLastMoveHighlights();

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

  function removeSquareHighlights() {
    $('#chessBoard .square-55d63').removeClass(
      'highlight-legal highlight-legal-capture highlight-selected'
    );
  }

  function highlightLegalMoves(source) {
    removeSquareHighlights();
    $('#chessBoard .square-' + source).addClass('highlight-selected');

    if (!showLegalDots) return;

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
      board.position(game.fen(), true);
      onMoveExecuted(move);
      broadcastMove(move);
    }
  }

  function handleTakebackRequest() {
    if (game.history().length === 0) {
      showToast('No moves made yet.', 'warning');
      return;
    }

    if (currentMode === 'offline_local') {
      executeUndo();
      showToast('Move retracted.', 'info');
      return;
    }

    if (!isConnected) {
      showToast('Connect with opponent to request takeback.', 'warning');
      return;
    }

    const packet = { type: 'takeback_request' };
    if (currentMode === 'online') sendWebRTC(packet);
    if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);

    showToast('Takeback request sent to opponent...', 'info');
  }

  function executeUndo() {
    const undone = game.undo();
    if (!undone) return;

    board.position(game.fen(), true);

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

  function checkGameStatus() {
    const isMyTurn = game.turn() === myColor;

    if (game.in_check() && !game.in_checkmate()) {
      playSound('check');
      dom.floatingCheckBanner.classList.remove('hidden');
      dom.floatingCheckBanner.classList.add('flex');
      dom.floatingCheckText.textContent = isMyTurn ? 'Check! King imperiled!' : 'Opponent in Check!';
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
        triggerGameOverModal('Checkmate!', `${winnerColor === 'w' ? 'White' : 'Black'} wins!`, FURINA_QUOTES.checkmateWhite[0], null);
      } else if (isWinner) {
        playSound('victory');
        triggerGameOverModal('Victory by Checkmate!', 'Triumph! You have defeated the opposing sovereign.', winnerColor === 'w' ? FURINA_QUOTES.checkmateWhite[0] : FURINA_QUOTES.checkmateBlack[0], true);
      } else {
        playSound('defeat');
        triggerGameOverModal('Defeat by Checkmate', 'The curtains fall upon your king.', winnerColor === 'w' ? FURINA_QUOTES.checkmateWhite[1] : FURINA_QUOTES.checkmateBlack[1], false);
      }
      return;
    }

    if (game.in_stalemate()) {
      isGameOver = true;
      stopClock();
      playSound('defeat');
      triggerGameOverModal('Stalemate (Draw)', 'No legal moves remain.', FURINA_QUOTES.draw[0], null);
      return;
    }

    if (game.in_threefold_repetition() || game.insufficient_material() || game.in_draw()) {
      isGameOver = true;
      stopClock();
      playSound('defeat');
      triggerGameOverModal('Draw Declared', 'The game concludes in a draw.', FURINA_QUOTES.draw[0], null);
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
      dom.gameOverIcon.className = 'fa-solid fa-trophy text-gold-400';
    } else if (isWinner === false) {
      dom.gameOverIcon.className = 'fa-solid fa-heart-crack text-rose-400';
    } else {
      dom.gameOverIcon.className = 'fa-solid fa-scale-balanced text-hydro-400';
    }

    dom.gameOverModal.classList.remove('hidden');
    dom.gameOverModal.classList.add('flex');
  }

  function closeGameOverModal() {
    dom.gameOverModal.classList.add('hidden');
    dom.gameOverModal.classList.remove('flex');
  }

  // ==========================================================================
  // 7. PASS & PLAY, BLUETOOTH & MULTI-TAB MODES
  // ==========================================================================

  function startOfflinePassPlay() {
    currentMode = 'offline_local';
    isConnected = true;
    isGameOver = false;

    updateConnectionPill('connected', 'Pass & Play');

    dom.selfName.textContent = 'Player 1 (White)';
    dom.selfColorBadge.textContent = 'White';
    dom.opponentName.textContent = 'Player 2 (Black)';
    dom.opponentColorBadge.textContent = 'Black';

    dom.takebackBtnText.textContent = 'Undo';

    resetClocks();
    game.reset();
    board.position('start', true);
    board.orientation('white');

    switchSidebarTab('tab-moves');

    playSound('victory');
    setFurinaQuote('gameStart');
    showToast('Local Pass & Play started!', 'success');
    appendChatMessage('System', 'Local Pass & Play mode active.', 'system');
    updateUI();
  }

  function initMultiTabOffline(role) {
    currentMode = 'offline_tab';
    isConnected = true;
    isGameOver = false;

    if (!('BroadcastChannel' in window)) {
      showToast('BroadcastChannel not supported in this browser.', 'error');
      return;
    }

    broadcastChan = new BroadcastChannel('fontaine_offline_chess_channel');
    broadcastChan.onmessage = (e) => handleIncomingData(e.data);

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
    board.position('start', true);

    switchSidebarTab('tab-moves');

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
    showToast(`Started dual window as ${role === 'w' ? 'White' : 'Black'}!`, 'success');
    appendChatMessage('System', 'Offline dual-window channel active.', 'system');
    updateUI();
  }

  function checkBluetoothSupport() {
    if ('bluetooth' in navigator) {
      dom.bluetoothSupportBadge.textContent = 'Supported';
      dom.bluetoothSupportBadge.className = 'text-[10px] font-mono px-1.5 rounded bg-emerald-950 text-emerald-300';
      dom.bluetoothDesc.textContent = 'Web Bluetooth API is available. Click below to pair.';
    } else {
      dom.bluetoothSupportBadge.textContent = 'Not Supported';
      dom.bluetoothSupportBadge.className = 'text-[10px] font-mono px-1.5 rounded bg-rose-950 text-rose-300';
      dom.bluetoothDesc.textContent = 'Web Bluetooth not supported on this browser engine.';
    }
  }

  async function requestBluetoothConnection() {
    if (!('bluetooth' in navigator)) {
      showToast('Web Bluetooth not supported.', 'error');
      return;
    }

    try {
      showToast('Scanning for Bluetooth devices...', 'info');
      bluetoothDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });

      if (bluetoothDevice) {
        showToast(`Paired: ${bluetoothDevice.name || 'Bluetooth Device'}`, 'success');
        updateConnectionPill('connected', `BT: ${bluetoothDevice.name || 'Device'}`);
        isConnected = true;
        updateUI();
      }
    } catch (e) {
      if (e.name !== 'NotFoundError') {
        console.error('Bluetooth error:', e);
        showToast(`Bluetooth pairing failed: ${e.message}`, 'warning');
      }
    }
  }

  // ==========================================================================
  // 8. AUDIO & WALTZ MUSIC
  // ==========================================================================

  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
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
      const master = ctx.createGain();
      master.gain.setValueAtTime(soundVolume, now);
      master.connect(ctx.destination);

      if (soundStyle === 'arcade') {
        playArcadeSound(ctx, master, type, now);
      } else if (soundStyle === 'modern') {
        playModernSound(ctx, master, type, now);
      } else {
        playOperaSound(ctx, master, type, now);
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  function playOperaSound(ctx, master, type, now) {
    if (type === 'move') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(master);
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
      gain.connect(master);
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
        gain.connect(master);
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
        gain.connect(master);
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
        gain.connect(master);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.52);
      });
    } else if (type === 'droplet') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.06);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  }

  function playArcadeSound(ctx, master, type, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    if (type === 'move') {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(440, now + 0.04);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'capture') {
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.12);
    } else {
      playOperaSound(ctx, master, type, now);
    }
  }

  function playModernSound(ctx, master, type, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (type === 'move') {
      osc.frequency.setValueAtTime(540, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'capture') {
      osc.frequency.setValueAtTime(920, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      playOperaSound(ctx, master, type, now);
    }
  }

  function toggleBackgroundMusic() {
    isMusicPlaying = !isMusicPlaying;
    if (isMusicPlaying) {
      startFontaineWaltz();
      dom.bgMusicIcon.className = 'fa-solid fa-music text-hydro-400 animate-bounce';
      dom.bgMusicLabel.textContent = 'Waltz On';
      dom.modalMusicToggleBtn.textContent = 'Pause';
      showToast('Fontaine Waltz playing 🎵', 'info');
    } else {
      stopFontaineWaltz();
      dom.bgMusicIcon.className = 'fa-solid fa-music text-slate-400';
      dom.bgMusicLabel.textContent = 'Waltz Off';
      dom.modalMusicToggleBtn.textContent = 'Play';
      showToast('Waltz paused.', 'info');
    }
  }

  function startFontaineWaltz() {
    stopFontaineWaltz();
    const ctx = getAudioContext();
    if (!ctx) return;

    const chords = [
      { bass: 87.31, chord: [261.63, 311.13, 392.00] },
      { bass: 116.54, chord: [293.66, 349.23, 466.16] },
      { bass: 130.81, chord: [261.63, 329.63, 392.00] },
      { bass: 87.31, chord: [261.63, 311.13, 392.00] }
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
      if (beat === 0) musicMeasure++;
    }, 450);
  }

  function stopFontaineWaltz() {
    if (musicLoopInterval) {
      clearInterval(musicLoopInterval);
      musicLoopInterval = null;
    }
  }

  // ==========================================================================
  // 9. CHESS CLOCK & TIMER
  // ==========================================================================

  function resetClocks() {
    stopClock();
    whiteTime = timePreset.base;
    blackTime = timePreset.base;
    updateClockDisplay();
  }

  function startClock() {
    if (timePreset.base === 0) return;
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
        if (whiteTime <= 0) handleTimeOut('w');
      } else {
        blackTime = Math.max(0, blackTime - delta);
        if (blackTime <= 0) handleTimeOut('b');
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

    const isMyTurn = game.turn() === myColor;
    if (isMyTurn && clockRunning) {
      dom.selfClockWrapper.className = 'chess-clock active-clock';
      dom.opponentClockWrapper.className = 'chess-clock';
    } else if (!isMyTurn && clockRunning) {
      dom.selfClockWrapper.className = 'chess-clock';
      dom.opponentClockWrapper.className = 'chess-clock active-clock';
    } else {
      dom.selfClockWrapper.className = 'chess-clock';
      dom.opponentClockWrapper.className = 'chess-clock';
    }

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
      triggerGameOverModal(`Time Out! ${winnerName} Wins`, `${flaggedColor === 'w' ? 'White' : 'Black'} flagged.`, FURINA_QUOTES.timeOut[0], null);
    } else if (isWinner) {
      playSound('victory');
      triggerGameOverModal('Victory on Time!', 'Opponent ran out of time!', FURINA_QUOTES.timeOut[0], true);
    } else {
      playSound('defeat');
      triggerGameOverModal('Defeat on Time', 'Your clock ran dry.', FURINA_QUOTES.timeOut[1], false);
    }
  }

  // ==========================================================================
  // 10. UI & CHAT
  // ==========================================================================

  function updateUI() {
    const isMyTurn = game.turn() === myColor;
    const currentTurnColor = game.turn() === 'w' ? 'White' : 'Black';

    const moveNumber = Math.floor(game.history().length / 2) + 1;
    dom.moveCountBadge.textContent = `Move ${moveNumber} (${currentTurnColor})`;

    if (currentMode === 'offline_local') {
      dom.selfTurnBadge.classList.remove('hidden');
      dom.selfTurnBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ${currentTurnColor} to move`;
      dom.opponentTurnBadge.classList.add('hidden');

      dom.verdictStatusTitle.textContent = `Pass & Play: ${currentTurnColor}'s Move`;
      dom.verdictStatusDesc.textContent = 'Play on the shared screen.';

    } else if (!isConnected) {
      dom.selfTurnBadge.classList.remove('hidden');
      dom.selfTurnBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> waiting`;
      dom.opponentTurnBadge.classList.add('hidden');

      dom.verdictStatusTitle.textContent = 'Awaiting Opponent';
      dom.verdictStatusDesc.textContent = 'Share your invite link or connect to begin.';

    } else if (isGameOver) {
      dom.selfTurnBadge.classList.add('hidden');
      dom.opponentTurnBadge.classList.add('hidden');
      dom.verdictStatusTitle.textContent = 'Game Over';
      dom.verdictStatusDesc.textContent = 'The duel has concluded.';

    } else if (isMyTurn) {
      dom.selfTurnBadge.classList.remove('hidden');
      dom.selfTurnBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> your move`;
      dom.opponentTurnBadge.classList.add('hidden');

      dom.verdictStatusTitle.textContent = 'Your Move';
      dom.verdictStatusDesc.textContent = `Drag a piece to play (${myColor === 'w' ? 'White' : 'Black'}).`;

    } else {
      dom.selfTurnBadge.classList.add('hidden');
      dom.opponentTurnBadge.classList.remove('hidden');
      dom.opponentTurnBadge.classList.add('flex');

      dom.verdictStatusTitle.textContent = "Opponent's Move";
      dom.verdictStatusDesc.textContent = `Waiting for opponent (${opponentColor === 'w' ? 'White' : 'Black'})...`;
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

    dom.selfCapturedPieces.textContent = myCaptures.map(p => symbols[p]).join('');
    dom.selfScoreAdvantage.textContent = myAdvantage > 0 ? `+${myAdvantage}` : '';

    dom.opponentCapturedPieces.textContent = oppCaptures.map(p => symbols[p]).join('');
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
        <div class="flex items-center px-2 py-1 rounded text-xs ${
          isLatestPair ? 'bg-white/[0.06] text-white font-bold' : 'text-slate-300'
        }">
          <span class="w-8 text-slate-500 font-mono text-[11px]">${moveNum}.</span>
          <span class="flex-1 font-mono">${whiteMove}</span>
          <span class="flex-1 font-mono text-hydro-300">${blackMove}</span>
        </div>
      `;
    }

    dom.moveLogList.innerHTML = html;
    dom.moveLogContainer.scrollTop = dom.moveLogContainer.scrollHeight;
  }

  function appendChatMessage(sender, text, type = 'opponent') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubble = document.createElement('div');

    if (type === 'self') {
      bubble.className = 'chat-bubble-self p-2 max-w-[85%] ml-auto text-hydro-200 text-xs';
      bubble.innerHTML = `
        <div class="flex items-center justify-between gap-2 text-[9px] text-hydro-400 font-semibold mb-0.5">
          <span>You</span><span>${time}</span>
        </div>
        <p class="break-words">${escapeHTML(text)}</p>
      `;
    } else if (type === 'opponent') {
      bubble.className = 'chat-bubble-opponent p-2 max-w-[85%] mr-auto text-slate-200 text-xs';
      bubble.innerHTML = `
        <div class="flex items-center justify-between gap-2 text-[9px] text-gold-400 font-semibold mb-0.5">
          <span>${escapeHTML(sender)}</span><span>${time}</span>
        </div>
        <p class="break-words">${escapeHTML(text)}</p>
      `;
    } else {
      bubble.className = 'p-1.5 text-center text-[10.5px] text-slate-400 italic';
      bubble.textContent = text;
    }

    dom.chatMessages.appendChild(bubble);
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  }

  function handleSendChat(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    if (!isConnected) {
      showToast('Connect with opponent to chat!', 'warning');
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
    board.position('start', true);

    isGameOver = false;
    lastMoveSquares = { from: null, to: null };
    removeSquareHighlights();

    resetClocks();
    updateUI();
    setFurinaQuote('gameStart');
    playSound('victory');
    showToast('Rematch started! Curtains rise.', 'success');
  }

  // ==========================================================================
  // 11. TABS & SETTINGS LOGIC
  // ==========================================================================

  function switchSidebarTab(targetTabId) {
    dom.sidebarTabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === targetTabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    dom.sidebarTabContents.forEach(content => {
      if (content.id === targetTabId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    if (window.innerWidth < 1024) {
      const el = document.getElementById(targetTabId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function switchGameMode(mode) {
    currentMode = mode;
    dom.panelOnline.classList.add('hidden');
    dom.panelOfflineLocal.classList.add('hidden');
    dom.panelBluetooth.classList.add('hidden');
    dom.panelOfflineTab.classList.add('hidden');

    if (mode === 'online') {
      dom.panelOnline.classList.remove('hidden');
      updateConnectionPill('waiting', 'Ready to Host');
    } else if (mode === 'offline_local') {
      dom.panelOfflineLocal.classList.remove('hidden');
      updateConnectionPill('waiting', 'Pass & Play Ready');
    } else if (mode === 'bluetooth') {
      dom.panelBluetooth.classList.remove('hidden');
      checkBluetoothSupport();
      updateConnectionPill('waiting', 'Bluetooth Ready');
    } else if (mode === 'offline_tab') {
      dom.panelOfflineTab.classList.remove('hidden');
      updateConnectionPill('waiting', 'Dual Window Ready');
    }
  }

  function setBoardTheme(themeKey) {
    const theme = BOARD_THEMES[themeKey] || BOARD_THEMES.fontaine;
    currentTheme = themeKey;

    document.documentElement.style.setProperty('--square-light', theme.light);
    document.documentElement.style.setProperty('--square-dark', theme.dark);

    dom.activeThemeLabel.textContent = theme.name;

    dom.boardThemeSwatches.forEach(swatch => {
      if (swatch.getAttribute('data-theme') === themeKey) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });

    showToast(`Board theme: ${theme.name}`, 'info');
  }

  function setAnimationSpeed(speedKey) {
    dom.animSpeedButtons.forEach(btn => {
      if (btn.getAttribute('data-speed') === speedKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (speedKey === 'fast') animSpeedDuration = 140;
    else if (speedKey === 'slow') animSpeedDuration = 380;
    else animSpeedDuration = 230;

    if (board && board.config) {
      board.config.moveSpeed = animSpeedDuration;
    }

    showToast(`Animation speed: ${speedKey.toUpperCase()}`, 'info');
  }

  // ==========================================================================
  // 12. EVENT BINDINGS & APP INITIALIZATION
  // ==========================================================================

  function bindEvents() {
    dom.sidebarTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        switchSidebarTab(targetTab);
      });
    });

    dom.soundSettingsBtn.addEventListener('click', () => {
      switchSidebarTab('tab-settings');
    });

    dom.modeTabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        dom.modeTabs.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mode = e.currentTarget.getAttribute('data-mode');
        switchGameMode(mode);
      });
    });

    dom.timerButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        dom.timerButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const base = parseInt(e.currentTarget.getAttribute('data-time'), 10);
        const inc = parseInt(e.currentTarget.getAttribute('data-inc'), 10);
        timePreset = { base, inc };
        resetClocks();
        showToast(`Clock set: ${base === 0 ? 'No Clock' : formatTime(base) + (inc ? ' +' + inc + 's' : '')}`, 'info');
      });
    });

    // Create / Regenerate Host Link
    dom.createGameBtn.addEventListener('click', () => initHost(true));

    dom.copyLinkBtn.addEventListener('click', () => {
      const shareUrl = dom.shareLinkInput.value;
      if (!shareUrl || shareUrl.startsWith('Generating')) return;

      navigator.clipboard.writeText(shareUrl).then(() => {
        dom.copyIcon.className = 'fa-solid fa-check text-emerald-400';
        dom.copyBtnText.textContent = 'Copied';
        showToast('Invite link copied!', 'success');
        playSound('droplet');

        setTimeout(() => {
          dom.copyIcon.className = 'fa-solid fa-copy';
          dom.copyBtnText.textContent = 'Copy';
        }, 2200);
      }).catch(() => {
        dom.shareLinkInput.select();
        document.execCommand('copy');
        showToast('Link copied to clipboard!', 'success');
      });
    });

    // Manual Join Button with clean ID extraction
    dom.manualJoinBtn.addEventListener('click', () => {
      const val = extractPeerId(dom.manualJoinInput.value);
      if (!val) {
        showToast('Please enter a valid Peer ID or invite link.', 'warning');
        return;
      }
      initJoiner(val);
    });

    dom.cancelJoinBtn.addEventListener('click', () => {
      window.location.href = window.location.origin + window.location.pathname;
    });

    if (dom.retryJoinBtn) {
      dom.retryJoinBtn.addEventListener('click', () => {
        if (targetPeerId) {
          showToast('Retrying connection...', 'info');
          initJoiner(targetPeerId);
        }
      });
    }

    // Automatically recover signaling if tab goes to background and comes back
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (peer && peer.disconnected && !peer.destroyed) {
          console.log('Page visible again; reconnecting peer to signaling server...');
          peer.reconnect();
        }
      }
    });

    dom.showQrBtn.addEventListener('click', () => {
      dom.qrModal.classList.remove('hidden');
      dom.qrModal.classList.add('flex');
    });
    dom.closeQrModalBtn.addEventListener('click', () => {
      dom.qrModal.classList.add('hidden');
      dom.qrModal.classList.remove('flex');
    });

    dom.startPassPlayBtn.addEventListener('click', () => startOfflinePassPlay());
    dom.autoFlipToggle.addEventListener('change', (e) => {
      autoFlipEnabled = e.target.checked;
    });

    dom.scanBluetoothBtn.addEventListener('click', () => requestBluetoothConnection());
    dom.startBtSimulationBtn.addEventListener('click', () => startOfflinePassPlay());

    dom.startBroadcastWhiteBtn.addEventListener('click', () => initMultiTabOffline('w'));
    dom.startBroadcastBlackBtn.addEventListener('click', () => initMultiTabOffline('b'));

    dom.takebackBtn.addEventListener('click', () => handleTakebackRequest());
    dom.flipBoardBtn.addEventListener('click', () => {
      board.flip();
      reapplyLastMoveHighlights();
    });

    dom.fenCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(game.fen()).then(() => {
        showToast('FEN copied!', 'success');
        playSound('droplet');
      });
    });

    dom.offerDrawBtn.addEventListener('click', () => {
      if (!isConnected || isGameOver) return;
      if (confirm('Offer a draw to opponent?')) {
        const packet = { type: 'draw_offer' };
        if (currentMode === 'online') sendWebRTC(packet);
        if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);
        showToast('Draw offer sent.', 'info');
      }
    });

    dom.resignBtn.addEventListener('click', () => {
      if (!isConnected || isGameOver) return;
      if (confirm('Resign this game?')) {
        const packet = { type: 'resign', player: myColor };
        if (currentMode === 'online') sendWebRTC(packet);
        if (currentMode === 'offline_tab' && broadcastChan) broadcastChan.postMessage(packet);

        isGameOver = true;
        stopClock();
        playSound('defeat');
        triggerGameOverModal('You Have Resigned', 'You surrendered the duel.', FURINA_QUOTES.checkmateBlack[1], false);
      }
    });

    dom.navNewGameBtn.addEventListener('click', () => {
      if (confirm('Start a new game session?')) {
        window.location.href = window.location.origin + window.location.pathname;
      }
    });

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

      showToast('Takeback declined.', 'info');
    });

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
      showToast('Rematch requested...', 'info');
    });

    dom.closeGameOverModalBtn.addEventListener('click', closeGameOverModal);

    document.querySelectorAll('.promotion-piece-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const piece = e.currentTarget.getAttribute('data-piece');
        selectPromotionPiece(piece);
      });
    });

    // Settings Event Handlers
    dom.boardThemeSwatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const theme = e.currentTarget.getAttribute('data-theme');
        setBoardTheme(theme);
      });
    });

    dom.animSpeedButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const speed = e.currentTarget.getAttribute('data-speed');
        setAnimationSpeed(speed);
      });
    });

    dom.toggleLegalDots.addEventListener('change', (e) => {
      showLegalDots = e.target.checked;
      document.body.classList.toggle('hide-legal-dots', !showLegalDots);
      showToast(`Legal dots: ${showLegalDots ? 'On' : 'Off'}`, 'info');
    });

    dom.toggleCoords.addEventListener('change', (e) => {
      showCoordinates = e.target.checked;
      document.body.classList.toggle('hide-coords', !showCoordinates);
      showToast(`Coordinates: ${showCoordinates ? 'On' : 'Off'}`, 'info');
    });

    dom.soundStyleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        dom.soundStyleButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        soundStyle = e.currentTarget.getAttribute('data-style');
        playSound('move');
        showToast(`Sound: ${soundStyle.toUpperCase()}`, 'info');
      });
    });

    dom.testSoundBtn.addEventListener('click', () => {
      playSound('move');
      setTimeout(() => playSound('check'), 180);
    });

    dom.sfxVolumeSlider.addEventListener('input', (e) => {
      soundVolume = parseInt(e.target.value, 10) / 100;
      dom.sfxVolumeLabel.textContent = `${e.target.value}%`;
    });

    dom.musicVolumeSlider.addEventListener('input', (e) => {
      musicVolume = parseInt(e.target.value, 10) / 100;
      dom.musicVolumeLabel.textContent = `${e.target.value}%`;
    });

    dom.bgMusicToggleBtn.addEventListener('click', () => toggleBackgroundMusic());
    dom.modalMusicToggleBtn.addEventListener('click', () => toggleBackgroundMusic());

    dom.settingsCopyPeerIdBtn.addEventListener('click', () => {
      const peerId = dom.settingsPeerIdInput.value;
      if (!peerId || peerId.startsWith('Not') || peerId.startsWith('Connecting')) {
        showToast('Peer ID is still initializing.', 'warning');
        return;
      }
      navigator.clipboard.writeText(peerId).then(() => {
        showToast('Peer ID copied!', 'success');
        playSound('droplet');
      });
    });

    dom.resetSettingsBtn.addEventListener('click', () => {
      setBoardTheme('fontaine');
      setAnimationSpeed('normal');
      showLegalDots = true;
      dom.toggleLegalDots.checked = true;
      document.body.classList.remove('hide-legal-dots');

      showCoordinates = true;
      dom.toggleCoords.checked = true;
      document.body.classList.remove('hide-coords');

      soundVolume = 0.8;
      dom.sfxVolumeSlider.value = 80;
      dom.sfxVolumeLabel.textContent = '80%';

      musicVolume = 0.4;
      dom.musicVolumeSlider.value = 40;
      dom.musicVolumeLabel.textContent = '40%';

      soundStyle = 'opera';
      dom.soundStyleButtons.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-style') === 'opera');
      });

      showToast('Settings reset to defaults.', 'info');
    });

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

  // ==========================================================================
  // 13. APP BOOTSTRAP
  // ==========================================================================

  function initApp() {
    initChess();
    bindEvents();
    setFurinaQuote('welcome');
    resetClocks();

    const urlParams = new URLSearchParams(window.location.search);
    const rawJoin = urlParams.get('join');
    const joinId = extractPeerId(rawJoin);

    if (joinId) {
      // JOIN MODE: Initiates peer and connects to host ID found in URL
      initJoiner(joinId);
    } else {
      // HOST MODE: Generates Peer ID immediately so invite link is ready instantly
      initHost();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
