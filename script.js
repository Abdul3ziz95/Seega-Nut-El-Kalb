// ===================================
// PWA: تسجيل Service Worker (للتشغيل دون اتصال)
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
// منطق اللعبة "نط الكلب"
// ===================================

const boardElement = document.getElementById('board');
const statusElement = document.getElementById('game-status'); // العنصر القديم
const resetButton = document.getElementById('reset-button');
const rulesButton = document.getElementById('rules-button'); 
const alertOverlay = document.getElementById('custom-alert-overlay');
const alertMessage = document.getElementById('alert-message');
const alertButton = document.getElementById('alert-ok-button');

// 🟢 NEW: عناصر حالة اللاعبين والقطع المأسورة
const player1StatusContainer = document.getElementById('player1-status-container');
const player2StatusContainer = document.getElementById('player2-status-container');
const player1TurnLabel = document.getElementById('player1-turn'); // اللاعب الأسود (الأسفل)
const player2TurnLabel = document.getElementById('player2-turn'); // اللاعب الأحمر (الأعلى)
const player1CapturesDisplay = document.getElementById('player1-captures'); // لعرض قطع اللاعب 2 المأسورة (الأسود هو من أسرها)
const player2CapturesDisplay = document.getElementById('player2-captures'); // لعرض قطع اللاعب 1 المأسورة (الأحمر هو من أسرها)


// إعدادات اللعبة
const BOARD_SIZE = 5; 
const CENTER_R = 2; 
const CENTER_C = 2; 
const PLAYER1_PIECE = 1; 
const PLAYER2_PIECE = 2; 
const GAME_STATE_KEY = 'nutElKalbGameState'; 

// متغيرات النط المتتالي
let canChainJump = false; 
let chainJumpTimer = null; 
const CHAIN_JUMP_TIME = 2000; // 2 ثانية

// 🟢 NEW: متغيرات لحساب القطع المأسورة
let player1Captures = 0; // عدد القطع التي أسرها اللاعب 1 (الأسود) - أي قطع اللاعب 2
let player2Captures = 0; // عدد القطع التي أسرها اللاعب 2 (الأحمر) - أي قطع اللاعب 1

let board = []; 
let currentPlayer = 0; 
let selectedPiece = null; 
let isSacrificePhase = true; 
let gameOver = false;


// 🛑 دالة عرض التنبيه المخصص (معطلة)
function showAlert(message) {
    // تم تعطيل جميع التلميحات
}

// دالة إخفاء التنبيه
alertButton.addEventListener('click', () => {
    alertOverlay.classList.add('hidden');
});

// 🟢 NEW: دالة لعرض التعليمات السودانية
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

// 🟢 NEW: ربط زر القواعد بالدالة
rulesButton.addEventListener('click', showSudaneseRules);


// 🛑 New: Save game state to localStorage
function saveGameState() {
    const state = {
        board: board,
        currentPlayer: currentPlayer,
        selectedPiece: selectedPiece,
        isSacrificePhase: isSacrificePhase,
        gameOver: gameOver,
        // 🟢 حفظ متغيرات القطع المأسورة
        player1Captures: player1Captures, 
        player2Captures: player2Captures
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
}

// 🛑 New: Load game state from localStorage
function loadGameState() {
    const savedState = localStorage.getItem(GAME_STATE_KEY);
    if (savedState) {
        const state = JSON.parse(savedState);
        board = state.board;
        currentPlayer = state.currentPlayer;
        selectedPiece = state.selectedPiece;
        isSacrificePhase = state.isSacrificePhase;
        gameOver = state.gameOver;

        // 🟢 تحميل متغيرات القطع المأسورة
        player1Captures = state.player1Captures || 0; 
        player2Captures = state.player2Captures || 0; 
        
        // إعادة تعيين حالة النط المتتالي والمؤقت عند التحميل
        canChainJump = false; 
        if (chainJumpTimer) clearTimeout(chainJumpTimer);
        chainJumpTimer = null;

        return true;
    }
    return false;
}

// 1. تهيئة اللوحة ووضع 12 قطعة لكل لاعب (معدلة لاستخدام التحميل)
function initializeBoard() {
    // 🛑 محاولة تحميل الحالة المحفوظة
    if (loadGameState()) {
        renderBoard();
        updateStatus();
        return; // لا تبدأ لعبة جديدة إذا تم تحميل الحالة
    }
    
    // ------------------------------------
    // بدء لعبة جديدة (إذا لم يتم العثور على حالة محفوظة)
    // ------------------------------------
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)); 
    
    // وضع 12 قطعة للاعب 2 (الأحمر)
    let redPieces = [
        [0,0], [0,1], [0,2], [0,3], [0,4], 
        [1,0], [1,1], [1,2], [1,3], [1,4], 
        [2,0], [2,1] 
    ];
    redPieces.forEach(pos => {
        board[pos[0]][pos[1]] = PLAYER2_PIECE;
    });

    // وضع 12 قطعة للاعب 1 (الأسود)
    let blackPieces = [
        [4,0], [4,1], [4,2], [4,3], [4,4], 
        [3,0], [3,1], [3,2], [3,3], [3,4], 
        [2,3], [2,4] 
    ];
    blackPieces.forEach(pos => {
        board[pos[0]][pos[1]] = PLAYER1_PIECE;
    });

    // التأكد من أن المربع المركزي فارغ (إحداثي 2, 2)
    board[CENTER_R][CENTER_C] = 0; 
    
    selectedPiece = null;
    isSacrificePhase = true; 
    gameOver = false;
    canChainJump = false;
    if (chainJumpTimer) clearTimeout(chainJumpTimer);
    chainJumpTimer = null;

    // 🟢 تصفير عداد القطع المأسورة للعبة الجديدة
    player1Captures = 0;
    player2Captures = 0;

    // اختيار اللاعب الأول عشوائيًا
    currentPlayer = Math.random() < 0.5 ? PLAYER1_PIECE : PLAYER2_PIECE;

    saveGameState(); // 🛑 حفظ حالة اللعبة الجديدة
    renderBoard();
    updateStatus();
}

// عرض اللوحة في HTML
function renderBoard() {
    boardElement.innerHTML = ''; 
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            
            // ... (تلوين المربعات الأساسي) ...
            if ((r + c) % 2 === 0) {
                 cell.style.backgroundColor = 'var(--cell-light)';
            } else {
                 cell.style.backgroundColor = 'var(--cell-dark)';
            }
            
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', handleCellClick);
            
            // تمييز المربع المركزي
            if (r === CENTER_R && c === CENTER_C) {
                cell.style.backgroundColor = '#FFD1D1'; 
            }

            const pieceType = board[r][c];
            if (pieceType !== 0) {
                const piece = document.createElement('div');
                piece.classList.add('piece', pieceType === PLAYER1_PIECE ? 'player1' : 'player2');
                cell.appendChild(piece);
            }
            
            // إضافة كلاس 'selected' للـ CELL إذا كانت القطعة مختارة
            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                 cell.classList.add('selected');
            }

            boardElement.appendChild(cell);
        }
    }
    boardElement.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    boardElement.style.gridTemplateRows = `repeat(${BOARD_SIZE}, 1fr)`;
}

// 🛑 التعديل هنا: استخدام الواجهات الجديدة لحالة الدور وعرض القطع المأسورة
function updateStatus() {
    
    // 1. إخفاء جميع مؤشرات الدور القديمة والجديدة
    statusElement.style.display = 'none'; // إخفاء القديم
    player1TurnLabel.classList.remove('active');
    player2TurnLabel.classList.remove('active');
    
    // 2. مسح القطع المأسورة القديمة
    player1CapturesDisplay.innerHTML = '';
    player2CapturesDisplay.innerHTML = '';

    let baseStatusText = ` دورك`;

    if (isSacrificePhase) {
        baseStatusText = " (مرحلة التضحية)";
    } else if (canChainJump) {
        baseStatusText = " (نط متتالي)";
    }
    
    // 3. تحديث حالة الفوز
    if (gameOver) {
        const winnerColor = currentPlayer === PLAYER1_PIECE ? 'الأحمر' : 'الأسود';
        
        // عرض حالة الفوز في الواجهتين
        player1TurnLabel.textContent = `انتهت! الفائز: ${winnerColor} 🏆`;
        player1TurnLabel.style.color = 'var(--board-color)';
        player1TurnLabel.classList.add('active'); 
        
        player2TurnLabel.textContent = `انتهت! الفائز: ${winnerColor} 🏆`;
        player2TurnLabel.style.color = 'var(--board-color)';
        player2TurnLabel.classList.add('active'); 
        return;
    }
    
    // 4. تحديث حالة الدور
    if (currentPlayer === PLAYER1_PIECE) { // اللاعب الأسود (الأسفل)
        player1TurnLabel.textContent = `🐾${baseStatusText}`;
        player1TurnLabel.style.color = 'var(--player1-color)';
        player1TurnLabel.classList.add('active');
    } else { // اللاعب الأحمر (الأعلى)
        player2TurnLabel.textContent = `🐕${baseStatusText}`;
        player2TurnLabel.style.color = 'var(--player2-color)';
        player2TurnLabel.classList.add('active');
    }
    
    // 5. عرض القطع المأسورة
    
    // القطع التي أسرها اللاعب الأسود (player1Captures) هي قطع اللاعب الأحمر (player2)
    for (let i = 0; i < player1Captures; i++) {
        const piece = document.createElement('div');
        piece.classList.add('captured-piece', 'player2');
        player1CapturesDisplay.appendChild(piece);
    }

    // القطع التي أسرها اللاعب الأحمر (player2Captures) هي قطع اللاعب الأسود (player1)
    for (let i = 0; i < player2Captures; i++) {
        const piece = document.createElement('div');
        piece.classList.add('captured-piece', 'player1');
        player2CapturesDisplay.appendChild(piece);
    }
}

// ... (بقية دوال المساعدة: canMove, canJumpAgain, canPlayerMove) ...


// معالج النقر على المربع أو القطعة
function handleCellClick(event) {
    if (gameOver) return;

    const target = event.currentTarget;
    const r = parseInt(target.dataset.row);
    const c = parseInt(target.dataset.col);

    const pieceType = board[r][c];
    
    // Enforcement of Chain Jump 
    if (canChainJump) {
        if (selectedPiece && pieceType === 0) {
            // محاولة الحركة - يجب أن تكون نط قاتل لتستمر السلسلة
            tryMove(r, c); 
        } else if (selectedPiece && pieceType === currentPlayer && selectedPiece.r === r && selectedPiece.c === c) {
            // النقر على نفس القطعة مرة أخرى يعني إنهاء الدور (إلغاء التحديد + إنهاء الدور)
            finishTurn(true); 
        }
        return; 
    }
    // ------------------------------------

    if (selectedPiece) {
        // حالة 1: يوجد قطعة مختارة
        if (pieceType === currentPlayer) {
            selectPiece(r, c); 
        } else if (pieceType === 0) {
            tryMove(r, c);
        }
    } else {
        // حالة 2: لا يوجد قطعة مختارة، يختار قطعة للاعب الحالي
        if (pieceType === currentPlayer) {
            selectPiece(r, c);
        }
    }
}

// وظيفة تحديد القطعة
function selectPiece(r, c) {
    if (chainJumpTimer) {
        clearTimeout(chainJumpTimer);
        chainJumpTimer = null;
    }
    
    // إزالة التحديد القديم
    if (selectedPiece) {
        // إزالة الكلاس 'selected' من الخلية القديمة
        const oldCell = document.querySelector(`[data-row="${selectedPiece.r}"][data-col="${selectedPiece.c}"]`);
        if (oldCell) oldCell.classList.remove('selected');
    }
    
    // إذا ضغط على القطعة المختارة نفسها، يتم إلغاء التحديد
    if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
        selectedPiece = null;
        if (canChainJump) finishTurn(true); 
    } else {
        // اختر قطعة جديدة
        selectedPiece = { r: r, c: c };
        // إضافة الكلاس 'selected' للخلية الجديدة
        const newCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        if (newCell) newCell.classList.add('selected');
    }
    saveGameState(); 
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
    if (isDoubleStep) {
        const jumpedR = oldR + Math.floor(dR / 2);
        const jumpedC = oldC + Math.floor(dC / 2);
        pieceInMiddle = board[jumpedR][jumpedC];
    }

    // ===============================================
    // 🎯 مرحلة التضحية
    // ===============================================
    if (isSacrificePhase) {
        if (!isSingleStep || newR !== CENTER_R || newC !== CENTER_C) {
            selectPiece(oldR, oldC);
            return;
        }

        board[newR][newC] = currentPlayer;
        board[oldR][oldC] = 0;
        
        isSacrificePhase = false; 
        finishTurn(); 

    // ===============================================
    // 🎯 مرحلة اللعب العادية
    // ===============================================
    } else {
        
        if (isSingleStep) {
            // حركة خطوة واحدة
            
            if (canChainJump) {
                selectPiece(oldR, oldC); 
                return;
            }

            board[newR][newC] = currentPlayer;
            board[oldR][oldC] = 0;

            finishTurn();
            
        } else if (isDoubleStep) {
            // نط قاتل (أسر)
            
            if (pieceInMiddle === opponent) {
                
                board[newR][newC] = currentPlayer;
                board[oldR][oldC] = 0;

                const jumpedR = oldR + Math.floor(dR / 2);
                const jumpedC = oldC + Math.floor(dC / 2);
                board[jumpedR][jumpedC] = 0;
                
                // 🟢 NEW: تحديث عداد القطع المأسورة
                if (currentPlayer === PLAYER1_PIECE) {
                    player1Captures++; // اللاعب الأسود (PLAYER1) أسر قطعة حمراء (PLAYER2)
                } else {
                    player2Captures++; // اللاعب الأحمر (PLAYER2) أسر قطعة سوداء (PLAYER1)
                }
                
                // منطق النط المتتالي
                if (canJumpAgain(newR, newC)) {
                    
                    if (chainJumpTimer) clearTimeout(chainJumpTimer);
                    
                    canChainJump = true; 
                    selectedPiece = { r: newR, c: newC };
                    
                    // بدء مؤقت 2 ثانية
                    chainJumpTimer = setTimeout(() => {
                        if (canChainJump) { 
                            finishTurn(); 
                        }
                    }, CHAIN_JUMP_TIME); 
                    
                    renderBoard();
                    return; 

                } else {
                    // لا يمكن النط مرة أخرى، ينتهي الدور طبيعيًا
                    finishTurn();
                }
                
            } else {
                // ليس نط قاتل: ممنوع
                selectPiece(oldR, oldC);
            }
        
        } else {
            // حركة غير مسموحة
            selectPiece(oldR, oldC);
        }
    }
    
    saveGameState(); 
    renderBoard();
}

// التحقق من الفائز
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


// إنهاء الدور وتغيير اللاعب (param: skipPlayerChange - تستخدم للنط المتتالي)
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
    
    // إزالة التحديد
    if (selectedPiece) {
        // إزالة الكلاس 'selected' من الخلية القديمة
        const oldCell = document.querySelector(`[data-row="${selectedPiece.r}"][data-col="${selectedPiece.c}"]`);
        if (oldCell) oldCell.classList.remove('selected');
    }
    selectedPiece = null;

    if (!skipPlayerChange) {
        // تغيير الدور إلى الخصم
        currentPlayer = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
        const nextPlayerColor = currentPlayer === PLAYER1_PIECE ? 'الأسود' : 'الأحمر';

        // التحقق من الجمود: إذا كان اللاعب التالي لا يستطيع الحركة، نمرر الدور
        if (!canPlayerMove(currentPlayer)) {
            
            currentPlayer = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

            // التحقق مرة أخرى: إذا كان اللاعب الأصلي أيضاً لا يستطيع الحركة، تنتهي اللعبة بالتعادل 
            if (!canPlayerMove(currentPlayer)) {
                gameOver = true;
            }
        }
    }
    
    saveGameState(); 
    updateStatus();
    renderBoard();
}

// 🛑 مسح حالة الحفظ وبدء لعبة جديدة
resetButton.addEventListener('click', () => {
    localStorage.removeItem(GAME_STATE_KEY);
    initializeBoard();
});

// بدء اللعبة عند التحميل (ستحاول التحميل أولاً)
initializeBoard();
                
