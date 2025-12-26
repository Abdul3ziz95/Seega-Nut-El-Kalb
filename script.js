// ===================================
// PWA: تسجيل Service Worker
// ===================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}


// ===================================
// منطق اللعبة "نط الكلب" - المتغيرات العامة والثوابت
// ===================================

const boardElement = document.getElementById('board');
const statusElement = document.getElementById('game-status');
const resetButton = document.getElementById('reset-button');
const rulesButton = document.getElementById('rules-button'); 
const alertOverlay = document.getElementById('custom-alert-overlay');
const alertMessage = document.getElementById('alert-message');
const alertButton = document.getElementById('alert-ok-button');

// 🌐 متغيرات UI/Modes
const mainMenu = document.getElementById('main-menu');
const aiSettings = document.getElementById('ai-settings');
const multiplayerSettings = document.getElementById('multiplayer-settings');
const gameContainer = document.getElementById('game-container');
const customizationPanel = document.getElementById('customization-panel');
const endChainJumpButton = document.getElementById('end-chain-jump');
const myIdDisplayEl = document.getElementById('my-id-display'); // من multiplayer.js

// 🕹️ متغيرات حالة اللعب الجديدة
const GAME_MODE = { LOCAL: 'LOCAL', AI: 'AI', ONLINE: 'ONLINE' };
const BOARD_SIZE = 5; 
const CENTER_R = 2; 
const CENTER_C = 2; 
const PLAYER1_PIECE = 1; 
const PLAYER2_PIECE = 2; 
const AI_PLAYER = PLAYER2_PIECE; // الكمبيوتر هو اللاعب 2 دائمًا
const GAME_STATE_KEY = 'nutElKalbGameState'; 

let gameMode = null;
let aiDifficulty = null; 
let onlinePlayerNumber = null; 

let canChainJump = false; 
let chainJumpTimer = null; 
const CHAIN_JUMP_TIME = 2000; // 2 ثانية

let board = []; 
let currentPlayer = 0; 
let selectedPiece = null; 
let isSacrificePhase = true; 
let gameOver = false;

// ------------------------------------
// 🌐 دوال عرض القوائم
// ------------------------------------

function showScreen(screenId) {
    const screens = [mainMenu, aiSettings, multiplayerSettings, gameContainer, customizationPanel];
    screens.forEach(screen => {
        if (screen.id === screenId) {
            screen.classList.remove('hidden');
        } else {
            screen.classList.add('hidden');
        }
    });
    endChainJumpButton.classList.add('hidden'); 
}

function showMainMenu() {
    showScreen('main-menu');
    gameMode = null;
    // إذا كان هناك اتصال PeerJS، قم بتدميره (موجود في multiplayer.js)
    if (typeof destroyPeer === 'function') destroyPeer(); 
    localStorage.removeItem(GAME_STATE_KEY); // مسح حالة اللعب المحفوظة
}

function showAISettings() {
    showScreen('ai-settings');
}

function showMultiplayerSettings() {
    showScreen('multiplayer-settings');
    // تهيئة PeerJS (موجود في multiplayer.js)
    if (typeof initializePeer === 'function') initializePeer(); 
}

function showCustomizationPanel() {
    showScreen('customization-panel');
}

// ------------------------------------
// 🎨 دوال التخصيص
// ------------------------------------
function applyCustomization() {
    const p1Color = document.getElementById('p1-color-picker').value;
    const p2Color = document.getElementById('p2-color-picker').value;
    const boardTheme = document.getElementById('board-theme-select').value;

    const root = document.documentElement;
    
    document.body.classList.remove('theme-wood', 'theme-marble', 'theme-dark');
    document.body.classList.add(`theme-${boardTheme}`);

    root.style.setProperty('--player1-color', p1Color);
    root.style.setProperty('--player2-color', p2Color);
    
    // حفظ التخصيص
    localStorage.setItem('customTheme', JSON.stringify({ p1Color, p2Color, boardTheme }));
    
    // إعادة رسم اللوحة لتطبيق التغييرات
    if (gameMode !== null) renderBoard();
}

function loadCustomization() {
    const savedTheme = localStorage.getItem('customTheme');
    if (savedTheme) {
        const { p1Color, p2Color, boardTheme } = JSON.parse(savedTheme);
        document.getElementById('p1-color-picker').value = p1Color;
        document.getElementById('p2-color-picker').value = p2Color;
        document.getElementById('board-theme-select').value = boardTheme;
    }
    applyCustomization();
}
// ------------------------------------
// 💾 دوال حفظ/تحميل الحالة
// ------------------------------------
function saveGameState() {
    const state = {
        board: board,
        currentPlayer: currentPlayer,
        selectedPiece: selectedPiece,
        isSacrificePhase: isSacrificePhase,
        gameOver: gameOver,
        gameMode: gameMode,
        aiDifficulty: aiDifficulty,
        onlinePlayerNumber: onlinePlayerNumber
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
}

function loadGameState() {
    const savedState = localStorage.getItem(GAME_STATE_KEY);
    if (savedState) {
        const state = JSON.parse(savedState);
        board = state.board;
        currentPlayer = state.currentPlayer;
        selectedPiece = state.selectedPiece;
        isSacrificePhase = state.isSacrificePhase;
        gameOver = state.gameOver;
        gameMode = state.gameMode;
        aiDifficulty = state.aiDifficulty;
        onlinePlayerNumber = state.onlinePlayerNumber;
        
        canChainJump = false; 
        if (chainJumpTimer) clearTimeout(chainJumpTimer);
        chainJumpTimer = null;

        return true;
    }
    return false;
}

// ------------------------------------
// 🏁 دالة بدء اللعبة (عامة لجميع الأوضاع)
// ------------------------------------
function startGame(mode, param = null) {
    gameMode = mode;
    aiDifficulty = null;
    onlinePlayerNumber = null;

    if (mode === GAME_MODE.AI) {
        aiDifficulty = param;
    } else if (mode === GAME_MODE.ONLINE) {
        onlinePlayerNumber = param;
    }

    if (mode !== GAME_MODE.ONLINE || param !== null) {
        showScreen('game-container');
        initializeBoard(mode, onlinePlayerNumber); 
    }
}

// 1. تهيئة اللوحة (من الكود الأصلي)
function initializeBoard(mode, onlinePlayer) {
    if (loadGameState() && gameMode !== null) {
        if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER) {
            triggerAIMove();
        }
        return; 
    }
    
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)); 
    
    let redPieces = [
        [0,0], [0,1], [0,2], [0,3], [0,4], 
        [1,0], [1,1], [1,2], [1,3], [1,4], 
        [2,0], [2,1] 
    ];
    redPieces.forEach(pos => {
        board[pos[0]][pos[1]] = PLAYER2_PIECE;
    });

    let blackPieces = [
        [4,0], [4,1], [4,2], [4,3], [4,4], 
        [3,0], [3,1], [3,2], [3,3], [3,4], 
        [2,3], [2,4] 
    ];
    blackPieces.forEach(pos => {
        board[pos[0]][pos[1]] = PLAYER1_PIECE;
    });

    board[CENTER_R][CENTER_C] = 0; 
    
    selectedPiece = null;
    isSacrificePhase = true; 
    gameOver = false;
    canChainJump = false;
    if (chainJumpTimer) clearTimeout(chainJumpTimer);
    chainJumpTimer = null;

    if (mode === GAME_MODE.ONLINE && onlinePlayer !== null) {
        currentPlayer = onlinePlayer; 
    } else {
        currentPlayer = Math.random() < 0.5 ? PLAYER1_PIECE : PLAYER2_PIECE;
    }
    
    saveGameState();
    renderBoard();
    updateStatus();

    if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER) {
        triggerAIMove();
    }
}

// 2. تحديث الحالة
function updateStatus() {
    if (gameOver) {
        const winner = currentPlayer === PLAYER1_PIECE ? 'الأحمر' : 'الأسود';
        statusElement.textContent = `انتهت اللعبة! اللاعب ${winner} هو الفائز! 🏆`;
        statusElement.style.color = 'var(--board-color)';
        return;
    }
    
    statusElement.style.color = currentPlayer === PLAYER1_PIECE ? 'var(--player1-color)' : 'var(--player2-color)';
    
    let statusText = `دورك`;
    
    if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER) {
        statusText = "دور الكمبيوتر...";
    } else if (gameMode === GAME_MODE.ONLINE && currentPlayer !== onlinePlayerNumber) {
        statusText = "دور الخصم عبر الإنترنت...";
    } else if (gameMode === GAME_MODE.ONLINE && currentPlayer === onlinePlayerNumber) {
        statusText = "دورك (أونلاين)";
    }

    if (isSacrificePhase) {
        statusText += " (مرحلة التضحية)";
    } else if (canChainJump) {
        statusText += " (نط متتالي)";
        if (gameMode !== GAME_MODE.AI) {
            endChainJumpButton.classList.remove('hidden');
        }
    } else {
        endChainJumpButton.classList.add('hidden');
    }
    
    statusElement.textContent = statusText;
}

// 3. عرض اللوحة (من الكود الأصلي)
function renderBoard() {
    boardElement.innerHTML = ''; 
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            
            // تطبيق الأنماط من CSS
            cell.classList.add('cell');
            
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', handleCellClick);
            
            const pieceType = board[r][c];
            if (pieceType !== 0) {
                const piece = document.createElement('div');
                piece.classList.add('piece', pieceType === PLAYER1_PIECE ? 'player1' : 'player2');
                cell.appendChild(piece);
            }
            
            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                 cell.classList.add('selected');
            }

            boardElement.appendChild(cell);
        }
    }
    boardElement.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    boardElement.style.gridTemplateRows = `repeat(${BOARD_SIZE}, 1fr)`;
}

// ------------------------------------
// 🛠️ دوال قواعد الحركة (من الكود الأصلي)
// ------------------------------------

function canMove(r, c) {
    const pieceType = board[r][c];
    const opponent = pieceType === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
    const singleSteps = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of singleSteps) {
        const newR = r + dr;
        const newC = c + dc;
        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === 0) {
            return true;
        }
    }
    const doubleSteps = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [2, -2], [-2, 2], [-2, -2]];
    for (const [dr, dc] of doubleSteps) {
        const newR = r + dr;
        const newC = c + dc;
        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === 0) {
            const jumpedR = r + Math.floor(dr / 2);
            const jumpedC = c + Math.floor(dc / 2);
            if (board[jumpedR][jumpedC] === opponent) {
                return true;
            }
        }
    }
    return false;
}

function canJumpAgain(r, c) {
    const pieceType = board[r][c];
    const opponent = pieceType === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
    const doubleSteps = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [2, -2], [-2, 2], [-2, -2]];
    for (const [dr, dc] of doubleSteps) {
        const newR = r + dr;
        const newC = c + dc;
        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === 0) {
            const jumpedR = r + Math.floor(dr / 2);
            const jumpedC = c + Math.floor(dc / 2);
            if (board[jumpedR][jumpedC] === opponent) {
                return true;
            }
        }
    }
    return false;
}

function canPlayerMove(player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                if (canMove(r, c)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// ------------------------------------
// ✋ معالج النقر (مُعدَّل للتحكم في الأوضاع)
// ------------------------------------
function handleCellClick(event) {
    if (gameOver) return;

    // 🛑 حظر الإدخال إذا كان دور الخصم (AI أو ONLINE)
    if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER) return;
    if (gameMode === GAME_MODE.ONLINE && currentPlayer !== onlinePlayerNumber) return;

    const target = event.currentTarget;
    const r = parseInt(target.dataset.row);
    const c = parseInt(target.dataset.col);

    const pieceType = board[r][c];
    
    if (canChainJump) {
        if (selectedPiece && pieceType === 0) {
            tryMove(r, c); 
        } else if (selectedPiece && pieceType === currentPlayer && selectedPiece.r === r && selectedPiece.c === c) {
            finishTurn(true); 
        }
        return; 
    }

    if (selectedPiece) {
        if (pieceType === currentPlayer) {
            selectPiece(r, c); 
        } else if (pieceType === 0) {
            tryMove(r, c);
        }
    } else {
        if (pieceType === currentPlayer) {
            selectPiece(r, c);
        }
    }
}

function selectPiece(r, c) {
    if (chainJumpTimer) {
        clearTimeout(chainJumpTimer);
        chainJumpTimer = null;
    }
    
    // إزالة التحديد القديم
    if (selectedPiece) {
        const oldCell = document.querySelector(`[data-row="${selectedPiece.r}"][data-col="${selectedPiece.c}"]`);
        if (oldCell) oldCell.classList.remove('selected');
    }
    
    if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
        selectedPiece = null;
        if (canChainJump) finishTurn(true); 
    } else {
        selectedPiece = { r: r, c: c };
        const newCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        if (newCell) newCell.classList.add('selected');
    }
    saveGameState(); 
    renderBoard();
}

// منطق محاولة الحركة (مُعدَّل لإرسال البيانات أونلاين)
function tryMove(newR, newC) {
    const oldR = selectedPiece.r;
    const oldC = selectedPiece.c;
    const opponent = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

    if (board[newR][newC] !== 0) {
        selectPiece(oldR, oldC); 
        return;
    }

    const dR = newR - oldR;
    const dC = newC - oldC;
    const absDR = Math.abs(dR);
    const absDC = Math.abs(dC);
    
    const isSingleStep = (absDR === 1 && absDC === 0) || (absDR === 0 && absDC === 1);
    const isDoubleStep = (absDR === 2 && absDC === 0) || (absDR === 0 && absDC === 2) || (absDR === 2 && absDC === 2);

    let pieceInMiddle = 0;
    let jumpedR = -1, jumpedC = -1;

    if (isDoubleStep) {
        jumpedR = oldR + Math.floor(dR / 2);
        jumpedC = oldC + Math.floor(dC / 2);
        pieceInMiddle = board[jumpedR][jumpedC];
    }
    
    let isJumpPerformed = false;
    let isSacrificePerformed = false;
    let canChainJumpAfterMove = false;
    
    // 🎯 مرحلة التضحية
    if (isSacrificePhase) {
        if (!isSingleStep || newR !== CENTER_R || newC !== CENTER_C) {
            selectPiece(oldR, oldC);
            return;
        }
        board[newR][newC] = currentPlayer;
        board[oldR][oldC] = 0;
        isSacrificePhase = false; 
        isSacrificePerformed = true;
        finishTurn(); 

    // 🎯 مرحلة اللعب العادية
    } else {
        
        if (isSingleStep) {
            if (canChainJump) {
                selectPiece(oldR, oldC); 
                return;
            }
            board[newR][newC] = currentPlayer;
            board[oldR][oldC] = 0;
            finishTurn();
            
        } else if (isDoubleStep && pieceInMiddle === opponent) {
            // نط قاتل (أسر)
            board[newR][newC] = currentPlayer;
            board[oldR][oldC] = 0;
            board[jumpedR][jumpedC] = 0;
            isJumpPerformed = true;
            
            // منطق النط المتتالي
            if (canJumpAgain(newR, newC)) {
                
                if (chainJumpTimer) clearTimeout(chainJumpTimer);
                canChainJump = true; 
                selectedPiece = { r: newR, c: newC };
                canChainJumpAfterMove = true;
                
                chainJumpTimer = setTimeout(() => {
                    if (canChainJump) { 
                        finishTurn(true); 
                    }
                }, CHAIN_JUMP_TIME); 
                
                renderBoard();
            } else {
                finishTurn();
            }
        } else {
            selectPiece(oldR, oldC);
            return; // حركة غير مسموحة
        }
    }
    
    // 🌐 إرسال الحركة عبر الإنترنت إذا كنا في وضع ONLINE
    if (gameMode === GAME_MODE.ONLINE && typeof sendMoveData === 'function') {
        const moveData = {
            r1: oldR, c1: oldC, r2: newR, c2: newC,
            isSacrifice: isSacrificePerformed,
            isJump: isJumpPerformed,
            capturedR: isJumpPerformed ? jumpedR : -1,
            capturedC: isJumpPerformed ? jumpedC : -1,
            canChainJump: canChainJumpAfterMove
        };
        sendMoveData(moveData);
    }
    
    saveGameState(); 
    renderBoard();
}

// ------------------------------------
// 🌐 تطبيق حركة الخصم (يتم استدعاؤها من multiplayer.js)
// ------------------------------------
function applyOpponentMove(move) {
    if (move.r1 === -1 && move.c1 === -1) { // إشارة إنهاء الدور
        finishTurn(false);
        return;
    }
    
    // تطبيق الحركة
    board[move.r2][move.c2] = board[move.r1][move.c1];
    board[move.r1][move.c1] = 0;
    
    if (move.isSacrifice) {
        isSacrificePhase = false;
    }

    if (move.isJump) {
        board[move.capturedR][move.capturedC] = 0;
    }
    
    // التحقق من النط المتتالي للخصم
    if (move.isJump && move.canChainJump) {
         selectedPiece = { r: move.r2, c: move.c2 };
         canChainJump = true;
         renderBoard();
         updateStatus();
         return; // لا نغير الدور
    }
    
    finishTurn(false);
}

// ------------------------------------
// 🛑 إنهاء الدور
// ------------------------------------
function finishTurn(skipPlayerChange = false) {
    checkWinCondition();
    if (gameOver) {
        renderBoard();
        updateStatus();
        saveGameState(); 
        return;
    }
    
    // إيقاف مؤقت النط المتتالي
    if (chainJumpTimer) {
        clearTimeout(chainJumpTimer);
        chainJumpTimer = null;
    }
    canChainJump = false; 
    endChainJumpButton.classList.add('hidden');

    // إزالة التحديد
    if (selectedPiece) {
        const oldCell = document.querySelector(`[data-row="${selectedPiece.r}"][data-col="${selectedPiece.c}"]`);
        if (oldCell) oldCell.classList.remove('selected');
    }
    selectedPiece = null;
    
    // 🌐 إرسال إشارة إنهاء الدور عبر الأونلاين (إذا كان النط المتتالي هو السبب)
    if (gameMode === GAME_MODE.ONLINE && skipPlayerChange && typeof sendFinishTurnSignal === 'function') {
        sendFinishTurnSignal(); 
    }

    if (!skipPlayerChange) {
        currentPlayer = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
        
        if (!canPlayerMove(currentPlayer)) {
            currentPlayer = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
            if (!canPlayerMove(currentPlayer)) {
                gameOver = true;
            }
        }
    }
    
    saveGameState(); 
    updateStatus();
    renderBoard();
    
    // 🛑 التحكم في اللعب بالكمبيوتر
    if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER && typeof triggerAIMove === 'function') {
        triggerAIMove();
    }
}

// ------------------------------------
// 🏆 التحقق من الفائز (من الكود الأصلي)
// ------------------------------------
function checkWinCondition() {
    const opponent = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
    let opponentPiecesCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === opponent) {
                opponentPiecesCount++;
            }
        }
    }
    if (opponentPiecesCount === 0) {
        gameOver = true;
    }
}


// ------------------------------------
// 📚 دوال القوانين والتنبيه (من الكود الأصلي)
// ------------------------------------
function showSudaneseRules() {
    const rulesText = `
        <h3 style="color: var(--board-color);">قوانين نط الكلب (مختصر)</h3>
        <p style="text-align: right; font-size: 0.95em;">
        * **البداية (التضحية):** أول حركة لازم تكون في المربع الفاضي (مربع الكلب) في نص اللوحة. اللاعب الأول بضحي بقطعة في المربع الفاضي، بعد داك اللعب العادي بيبدأ.
        * **الحركة العادية:** ممكن تتحرك خطوة واحدة بس (قدام، وراء، يمين، شمال). 
        * **النط والأكل:** عشان تاكل قطعة الخصم، لازم تنط من فوقها لمربع فاضي وراها مباشرة (أي اتجاه، حتى بالجنب). القطعة المأكولة بتتشال من اللوحة.
        * **النط المتتالي:** لو أكلت قطعة ولسه في قطعة تانية ممكن تاكلها بالقطعة ذاتها، عندك ثانيتين (2 ثانية) تنط تاني قبل ما يخلص دورك.
        * **الكسبان:** اللي بياكل كل قطع الخصم هو الكسبان!
        </p>
    `;
    alertMessage.innerHTML = rulesText;
    alertOverlay.classList.remove('hidden');
}

// ------------------------------------
// 🚀 بدء التطبيق
// ------------------------------------
resetButton.addEventListener('click', () => {
    localStorage.removeItem(GAME_STATE_KEY);
    showMainMenu(); 
});

rulesButton.addEventListener('click', showSudaneseRules);
alertButton.addEventListener('click', () => {
    alertOverlay.classList.add('hidden');
});

// ابدأ بتحميل التخصيص والواجهة
loadCustomization();
if (loadGameState() && gameMode !== null) {
    showScreen('game-container'); // عرض اللعبة إذا كانت محفوظة
    updateStatus();
    renderBoard();
} else {
    showMainMenu();
}
