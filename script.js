// ===================================
// PWA: تسجيل Service Worker (للتشغيل دون اتصال)
// ===================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 🛑 تم تحديث اسم الكاش لإجبار المتصفح على تحميل الملفات الجديدة 🛑
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
const selectionScreen = document.getElementById('selection-screen');
const startGameButton = document.getElementById('start-game-button');
const player1Selector = document.getElementById('player1-selector');
const player2Selector = document.getElementById('player2-selector');
const p1Status = document.getElementById('p1-choice-status');
const p2Status = document.getElementById('p2-choice-status');

const alertOverlay = document.getElementById('custom-alert-overlay');
const alertMessage = document.getElementById('alert-message');
const alertButton = document.getElementById('alert-ok-button');


// إعدادات اللعبة
const BOARD_SIZE = 5; 
const CENTER_R = 2; 
const CENTER_C = 2; 
const PLAYER1_PIECE = 1; 
const PLAYER2_PIECE = 2; 
const GAME_STATE_KEY = 'nutElKalbGameState'; 
const CHAIN_JUMP_TIME = 2000; 

// متغيرات حالة اللعبة
let board = []; 
let currentPlayer = 0; 
let selectedPiece = null; 
let isSacrificePhase = true; 
let gameOver = false;
let canChainJump = false; 
let chainJumpTimer = null; 
let player1StoneType = null; // نوع الحجر للاعب 1 (A, B, C...)
let player2StoneType = null; // نوع الحجر للاعب 2 (A, B, C...)


// ----------------------------------
// الدوال المساعدة
// ----------------------------------

function showAlert(message) {
    alertMessage.textContent = message;
    alertOverlay.classList.remove('hidden');
}

alertButton.addEventListener('click', () => {
    alertOverlay.classList.add('hidden');
});

function initializeBoard() {
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
    // ملء اللوحة بالقطع في المرحلة الأولى (كل الزوايا باستثناء المركز)
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (r === CENTER_R && c === CENTER_C) {
                board[r][c] = 0; // المركز فارغ
            } else if ((r === 0 || r === BOARD_SIZE - 1) && (c === 0 || c === BOARD_SIZE - 1)) {
                board[r][c] = 0; // الزوايا الخارجية فارغة
            } else {
                // وضع قطع اللاعب الأول في الجزء العلوي والأيسر
                if (r < CENTER_R || (r === CENTER_R && c < CENTER_C)) {
                    board[r][c] = PLAYER1_PIECE;
                }
                // وضع قطع اللاعب الثاني في الجزء السفلي والأيمن
                else if (r > CENTER_R || (r === CENTER_R && c > CENTER_C)) {
                    board[r][c] = PLAYER2_PIECE;
                }
            }
        }
    }
    
    // وضع القطع في الزوايا التي يجب أن تكون مملوءة (القريبة من المركز)
    board[1][1] = PLAYER1_PIECE;
    board[1][3] = PLAYER1_PIECE;
    board[3][1] = PLAYER2_PIECE;
    board[3][3] = PLAYER2_PIECE;
    
    // إعدادات البداية: اللاعب الأول يبدأ، ومرحلة التضحية نشطة
    currentPlayer = PLAYER1_PIECE;
    isSacrificePhase = true;
    gameOver = false;
    
    updateStatus();
    renderBoard();
}

// ----------------------------------
// دوال واجهة المستخدم (UI)
// ----------------------------------

function updateStatus() {
    if (gameOver) {
        const winner = currentPlayer === PLAYER1_PIECE ? 'الأسود' : 'الأحمر';
        statusElement.textContent = `انتهت اللعبة! الفائز هو اللاعب ${winner}.`;
        return;
    }
    
    const playerColor = currentPlayer === PLAYER1_PIECE ? 'الأسود' : 'الأحمر';
    if (isSacrificePhase) {
        statusElement.textContent = `دور اللاعب ${playerColor}. اختر قطعة للتضحية بها (إزالتها).`;
    } else {
        statusElement.textContent = `دور اللاعب ${playerColor}. اختر قطعة للحركة.`;
    }
}

function updateSelectionUI() {
    const p1StoneName = player1StoneType ? `حجر ${player1StoneType}` : 'لم يتم الاختيار بعد.';
    const p2StoneName = player2StoneType ? `حجر ${player2StoneType}` : 'لم يتم الاختيار بعد.';
    
    p1Status.textContent = p1StoneName;
    p2Status.textContent = p2StoneName;
    
    // تفعيل زر البدء
    if (player1StoneType && player2StoneType) {
        startGameButton.disabled = false;
    } else {
        startGameButton.disabled = true;
    }
}

// ----------------------------------
// دالة رسم اللوحة (حيث يتم تطبيق الأنماط الحجرية)
// ----------------------------------

function renderBoard() {
    boardElement.innerHTML = ''; 
    boardElement.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    boardElement.style.gridTemplateRows = `repeat(${BOARD_SIZE}, 1fr)`;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => handleCellClick(r, c));

            const pieceType = board[r][c];
            
            if (pieceType !== 0) {
                const piece = document.createElement('div');
                
                let stoneClass;
                if (pieceType === PLAYER1_PIECE) {
                    piece.classList.add('player1');
                    stoneClass = `stone-${player1StoneType}`; 
                } else {
                    piece.classList.add('player2');
                    stoneClass = `stone-${player2StoneType}`; 
                }
                
                // 🛑 هذه الخطوة تضيف الكلاسات piece و playerX و stone-X إلى القطعة 🛑
                piece.classList.add('piece', stoneClass); 
                cell.appendChild(piece);
            }
            
            // 🟢 إضافة كلاس 'selected' لتفعيل التمييز الأخضر في CSS 🟢
            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                 cell.classList.add('selected');
            }

            boardElement.appendChild(cell);
        }
    }
}


// ----------------------------------
// منطق النقر واللعب (الضروري لتغيير الأنماط)
// ----------------------------------

function handleCellClick(r, c) {
    if (gameOver) return;

    if (isSacrificePhase) {
        handleSacrifice(r, c);
    } else {
        handleMove(r, c);
    }
}

// ... (يجب إضافة دوال handleSacrifice و handleMove وبقية منطق اللعبة هنا) ...

function finishTurn(skipPlayerChange = false) {
    // ... (منطق إنهاء الدور) ...
    // ... (هنا يتم التحقق من الفائز وإنهاء النط المتتالي) ...

    if (!skipPlayerChange) {
        currentPlayer = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
        // ... (منطق التحقق من الجمود) ...
    }
    
    // 🛑 يجب التأكد من وجود هذه الدوال 🛑
    // saveGameState(); 
    // updateStatus();
    // renderBoard(); 
}

// ----------------------------------
// معالجات الأحداث (Event Handlers)
// ----------------------------------

// معالج أحداث أزرار الاختيار
document.querySelectorAll('.stone-option').forEach(button => {
    button.addEventListener('click', (e) => {
        const stoneType = e.currentTarget.dataset.stoneType;
        const playerSelector = e.currentTarget.closest('.player-selection');
        
        if (playerSelector.id === 'player1-selector') {
            player1StoneType = stoneType;
            playerSelector.querySelectorAll('.stone-option').forEach(btn => btn.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        } else {
            player2StoneType = stoneType;
            playerSelector.querySelectorAll('.stone-option').forEach(btn => btn.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        }
        updateSelectionUI();
    });
});

// معالج زر بدء اللعبة
startGameButton.addEventListener('click', () => {
    selectionScreen.classList.add('hidden');
    boardElement.classList.remove('hidden');
    initializeBoard(); 
});

// معالج زر إعادة التعيين
resetButton.addEventListener('click', () => {
    // localStorage.removeItem(GAME_STATE_KEY);
    player1StoneType = null;
    player2StoneType = null;
    selectionScreen.classList.remove('hidden');
    boardElement.classList.add('hidden');
    // إزالة تحديد الأزرار
    document.querySelectorAll('.stone-option').forEach(btn => btn.classList.remove('selected'));
    updateSelectionUI();
});

// ... (يجب إضافة الدالة loadGameState() وبقية الدوال المفقودة هنا) ...

// ******************************
// 🛑 ملاحظة هامة: هذا الكود يعيد البنية الأساسية للعبة.
// يجب التأكد من إضافة دوال handleSacrifice و handleMove وبقية المنطق
// الذي ربما حذفته عند مسح الملف بالكامل. 
// الكود أعلاه يكفي لإظهار شاشة الاختيار ورسم اللوحة عند بدء اللعبة 
// وتطبيق أنماط الحجر.
// ******************************

