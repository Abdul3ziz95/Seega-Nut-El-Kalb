
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
const statusElement = document.getElementById('game-status');
const resetButton = document.getElementById('reset-button');
const alertOverlay = document.getElementById('custom-alert-overlay');
const alertMessage = document.getElementById('alert-message');
const alertButton = document.getElementById('alert-ok-button');

// إعدادات اللعبة
const BOARD_SIZE = 5; 
const CENTER_R = 2; 
const CENTER_C = 2; 
const PLAYER1_PIECE = 1; 
const PLAYER2_PIECE = 2; 
const GAME_STATE_KEY = 'nutElKalbGameState'; // 🛑 مفتاح حفظ حالة اللعبة 🛑

// متغيرات النط المتتالي
let canChainJump = false; 
let chainJumpTimer = null; 
const CHAIN_JUMP_TIME = 2000; // 2 ثانية

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

// 🛑 New: Save game state to localStorage
function saveGameState() {
    const state = {
        board: board,
        currentPlayer: currentPlayer,
        selectedPiece: selectedPiece,
        isSacrificePhase: isSacrificePhase,
        gameOver: gameOver
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
            
            // 🟢 إضافة كلاس 'selected' لتفعيل التمييز الأخضر في CSS 🟢
            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                 cell.classList.add('selected');
            }

            boardElement.appendChild(cell);
        }
    }
    boardElement.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    boardElement.style.gridTemplateRows = `repeat(${BOARD_SIZE}, 1fr)`;
}

// 🛑 تحديث حالة الدور
function updateStatus() {
    if (gameOver) {
        const winner = currentPlayer === PLAYER1_PIECE ? 'الأحمر' : 'الأسود';
        statusElement.textContent = `انتهت اللعبة! اللاعب ${winner} هو الفائز! 🏆`;
        return;
    }
    
    const playerColor = currentPlayer === PLAYER1_PIECE ? 'الأسود' : 'الأحمر';
    let statusText = `الدور الحالي: اللاعب ${playerColor}`;

    if (isSacrificePhase) {
        statusText += " (مرحلة التضحية)";
    } else if (canChainJump) {
        statusText += " (دور إضافي - نط متتالي)";
    }
    statusElement.textContent = statusText;
}

// دالة مساعدة: التحقق مما إذا كانت قطعة معينة يمكنها الحركة (خطوة أو نط)
function canMove(r, c) {
    const pieceType = board[r][c];
    const opponent = pieceType === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

    // 1. فحص الحركات بخطوة واحدة (أفقي/عمودي فقط)
    const singleSteps = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of singleSteps) {
        const newR = r + dr;
        const newC = c + dc;
        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === 0) {
            return true;
        }
    }

    // 2. فحص حركات النط القاتل (خطوتين - جميع الاتجاهات)
    const doubleSteps = [
        [2, 0], [-2, 0], [0, 2], [0, -2], 
        [2, 2], [2, -2], [-2, 2], [-2, -2] 
    ];

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

// دالة مساعدة: التحقق مما إذا كانت قطعة معينة يمكنها القيام بحركة نط (قتل) فقط
function canJumpAgain(r, c) {
    const pieceType = board[r][c];
    const opponent = pieceType === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

    const doubleSteps = [
        [2, 0], [-2, 0], [0, 2], [0, -2], 
        [2, 2], [2, -2], [-2, 2], [-2, -2] 
    ];

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

// دالة التحقق من أن اللاعب يمكنه الحركة (لحل مشكلة الجمود)
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
        const newCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        if (newCell) newCell.classList.add('selected');
    }
    saveGameState(); // 🛑 حفظ التحديد
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
                
                // منطق النط المتتالي
                if (canJumpAgain(newR, newC)) {
                    
                    if (chainJumpTimer) clearTimeout(chainJumpTimer);
                    
                    canChainJump = true; 
                    selectedPiece = { r: newR, c: newC };
                    
                    // بدء مؤقت 2 ثانية
                    chainJumpTimer = setTimeout(() => {
                        if (canChainJump) { 
                            // 🛑 تم التعديل هنا: ينهي الدور ويحوله للاعب التالي تلقائياً
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
    
    saveGameState(); // 🛑 حفظ حالة اللعبة بعد الحركة
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
        saveGameState(); // 🛑 حفظ حالة الانتهاء
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
    
    saveGameState(); // 🛑 حفظ حالة اللعبة بعد نهاية الدور
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
