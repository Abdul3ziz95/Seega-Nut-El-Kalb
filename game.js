
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

// 🌐 متغيرات UI/Modes (تم تبسيطها وإخفاؤها لأننا لا نستخدم القوائم الآن)
// يتم الآن استخدام gameContainer فقط
const gameContainer = document.getElementById('game-container');
const endChainJumpButton = document.getElementById('end-chain-jump'); // يجب أن يبقى لإنهاء النط المتتالي

// 🕹️ متغيرات حالة اللعب الجديدة
const GAME_MODE = { LOCAL: 'LOCAL', AI: 'AI', ONLINE: 'ONLINE' }; // تم الاحتفاظ بها ولكن سنستخدم AI فقط
const BOARD_SIZE = 5; 
const CENTER_R = 2; 
const CENTER_C = 2; 
const PLAYER1_PIECE = 1; 
const PLAYER2_PIECE = 2; 
const AI_PLAYER = PLAYER2_PIECE; // 🛑 الكمبيوتر هو اللاعب 2 دائمًا
const GAME_STATE_KEY = 'nutElKalbGameState'; 

let gameMode = GAME_MODE.AI;      // 🛑 الإعداد الافتراضي: اللعب ضد الكمبيوتر
let aiDifficulty = 'medium';  // 🛑 الإعداد الافتراضي: صعوبة متوسطة
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
// 🌐 دوال عرض القوائم (تم تبسيطها)
// ------------------------------------

function showScreen(screenId) {
    // بما أننا ألغينا القوائم، لا نحتاج إلا لعرض حاوية اللعبة
    if (screenId === 'game-container') {
        gameContainer.classList.remove('hidden');
    }
}

// ------------------------------------
// 🎨 دوال التخصيص (تم تبسيطها لتطبيق التخصيص المحفوظ فقط)
// ------------------------------------
function applyCustomization() {
    // يمكن حذف أي متغيرات خاصة بالتخصيص غير مستخدمة (مثل p1Color, p2Color, boardTheme)
    // إذا لم يعد لديك أزرار اختيار الألوان في index.html.
    
    // سنفترض أننا نطبق التخصيص المحفوظ (إذا كان موجوداً)
    const savedTheme = localStorage.getItem('customTheme');
    if (savedTheme) {
        const { p1Color, p2Color, boardTheme } = JSON.parse(savedTheme);

        const root = document.documentElement;
        
        document.body.classList.remove('theme-wood', 'theme-marble', 'theme-dark');
        document.body.classList.add(`theme-${boardTheme}`);

        root.style.setProperty('--player1-color', p1Color);
        root.style.setProperty('--player2-color', p2Color);
    }
}

function loadCustomization() {
    // لا نحتاج لتحميل قيم الحقول لأنها محذوفة من index.html
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
function startGame(mode = GAME_MODE.AI, param = 'medium') { // 🛑 افتراضياً AI/متوسط
    gameMode = mode;
    aiDifficulty = param; 
    onlinePlayerNumber = null;

    showScreen('game-container');
    initializeBoard(mode); 

    // 🛑 تشغيل حركة الكمبيوتر فوراً إذا كان دوره
    if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER && typeof triggerAIMove === 'function') {
        triggerAIMove();
    }
}

// 1. تهيئة اللوحة
function initializeBoard(mode) {
    if (loadGameState()) {
        if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER && typeof triggerAIMove === 'function') {
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

    // 🛑 نبدأ عشوائياً بين اللاعبين
    currentPlayer = Math.random() < 0.5 ? PLAYER1_PIECE : PLAYER2_PIECE; 
    
    saveGameState();
    renderBoard();
    updateStatus();
    
    // 🛑 تشغيل حركة الكمبيوتر إذا كان دوره
    if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER && typeof triggerAIMove === 'function') {
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
    } else if (gameMode === GAME_MODE.AI && currentPlayer !== AI_PLAYER) {
        statusText = "دورك (أنت)";
    }

    if (isSacrificePhase) {
        statusText += " (مرحلة التضحية)";
    } else if (canChainJump) {
        statusText += " (نط متتالي)";
        // إظهار زر إنهاء النط المتتالي للاعب البشري فقط
        if (gameMode !== GAME_MODE.AI || currentPlayer !== AI_PLAYER) { 
            endChainJumpButton.classList.remove('hidden');
        }
    } else {
        endChainJumpButton.classList.add('hidden');
    }
    
    statusElement.textContent = statusText;
}

// 3. عرض اللوحة
function renderBoard() {
    boardElement.innerHTML = ''; 
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            
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
// 🛠️ دوال قواعد الحركة (غير معدلة)
// ------------------------------------

function canMove(r, c) {
    const pieceType = board[r][c];
    const opponent = pieceType === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
    const singleSteps = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of singleSteps) {
        const newR = r + dr;
        const newC = c + dc;
        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === 0) {
             // فحص خاص بمرحلة التضحية
            if (isSacrificePhase && (newR !== CENTER_R || newC !== CENTER_C)) continue;
            return true;
        }
    }
    const doubleSteps = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [2, -2], [-2, 2], [-2, -2]];
    if (!isSacrificePhase) {
        for (const [dr, dc] of doubleSteps) {
            const newR = r + dr;
            const newC = c + dc;
            if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === 0) {
                const jumpedR = r + Math.floor(dr / 2);
                const jumpedC = c + Math.floor(dC / 2);
                if (board[jumpedR][jumpedC] === opponent) {
                    return true;
                }
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

    // 🛑 حظر الإدخال إذا كان دور الكمبيوتر
    if (gameMode === GAME_MODE.AI && currentPlayer === AI_PLAYER) return;
    // 🛑 حظر الإدخال إذا كان دور الخصم (للتأكد فقط)
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

// منطق محاولة الحركة
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
    
    // 🎯 مرحلة التضحية
    if (isSacrificePhase) {
        if (!isSingleStep || newR !== CENTER_R || newC !== CENTER_C) {
            selectPiece(oldR, oldC);
            return;
        }
        board[newR][newC] = currentPlayer;
        board[oldR][oldC] = 0;
        isSacrificePhase = false; 
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
    
    saveGameState(); 
    renderBoard();
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
// 🏆 التحقق من الفائز
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
// 📚 دوال القوانين والتنبيه
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
    // 🛑 عند إعادة التعيين، ابدأ وضع AI متوسط مباشرة.
    startGame(GAME_MODE.AI, 'medium'); 
});

rulesButton.addEventListener('click', showSudaneseRules);
alertButton.addEventListener('click', () => {
    alertOverlay.classList.add('hidden');
});

endChainJumpButton.addEventListener('click', () => {
    if (canChainJump) {
        finishTurn(true); 
    }
});

// ابدأ بتحميل التخصيص
loadCustomization();

// 🛑 الآن، بدلاً من إظهار القائمة الرئيسية، سنبدأ اللعب ضد الكمبيوتر مباشرة.
if (loadGameState()) {
    showScreen('game-container'); // عرض اللعبة إذا كانت محفوظة
    updateStatus();
    renderBoard();
} else {
    // 🛑 إذا لم تكن هناك حالة محفوظة، ابدأ وضع AI متوسط.
    startGame(GAME_MODE.AI, 'medium');
}
