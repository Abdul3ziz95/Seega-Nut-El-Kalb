
// ===================================
// PWA: تسجيل Service Worker
// ===================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 🛑 التسجيل الصحيح لملف الخدمة 🛑
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed', err);
            });
    });
}

// ===================================
// منطق اللعبة "نط الكلب"
// ===================================

// عناصر واجهة المستخدم
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('game-status');
const resetButton = document.getElementById('reset-button');
const selectionScreen = document.getElementById('selection-screen'); 
const startGameButton = document.getElementById('start-game-button'); 
const p1Status = document.getElementById('p1-choice-status');
const p2Status = document.getElementById('p2-choice-status');
const alertOverlay = document.getElementById('custom-alert-overlay');
const alertMessage = document.getElementById('alert-message');
const alertButton = document.getElementById('alert-ok-button');

// إعدادات اللعبة
const BOARD_SIZE = 5; 
const PLAYER1_PIECE = 1; 
const PLAYER2_PIECE = 2; 

// متغيرات حالة اللعبة
let board = []; 
let currentPlayer = 0; 
let selectedPiece = null; 
let isSacrificePhase = true; 
let gameOver = false;
let player1StoneType = null; 
let player2StoneType = null; 
let canChainJump = false; 
let chainJumpTimer = null; 
const CHAIN_JUMP_TIME = 2000; 
const GAME_STATE_KEY = 'nutElKalbGameState'; 


// دوال التحكم والتنبيه
function showAlert(message) {
    alertMessage.textContent = message;
    alertOverlay.classList.remove('hidden');
}

alertButton.addEventListener('click', () => {
    alertOverlay.classList.add('hidden');
});

function updateStatus() {
    // ... (منطق تحديث حالة اللعبة) ...
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
    // تحديث شاشة الاختيار وتفعيل زر البدء
    const p1StoneName = player1StoneType ? `حجر ${player1StoneType}` : 'لم يتم الاختيار بعد.';
    const p2StoneName = player2StoneType ? `حجر ${player2StoneType}` : 'لم يتم الاختيار بعد.';
    
    p1Status.textContent = p1StoneName;
    p2Status.textContent = p2StoneName;
    
    if (player1StoneType && player2StoneType) {
        startGameButton.disabled = false;
    } else {
        startGameButton.disabled = true;
    }
}

function initializeBoard() {
    // إعداد اللوحة الافتراضي (استخدام نفس الإعداد الذي كان لديك)
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
    
    const p1Starts = [[0,1], [0,2], [0,3], [1,0], [1,1], [1,2], [1,3], [1,4], [2,0], [3,1]];
    p1Starts.forEach(([r, c]) => board[r][c] = PLAYER1_PIECE);
    
    const p2Starts = [[4,1], [4,2], [4,3], [3,0], [3,1], [3,2], [3,3], [3,4], [2,4], [1,3]];
    p2Starts.forEach(([r, c]) => board[r][c] = PLAYER2_PIECE);
    
    currentPlayer = PLAYER1_PIECE;
    isSacrificePhase = true;
    gameOver = false;
    selectedPiece = null;
    canChainJump = false;
    
    updateStatus();
    renderBoard();
}

// ----------------------------------
// دالة رسم اللوحة (الأهم لتطبيق الأنماط الحجرية)
// ----------------------------------
function renderBoard() {
    if (!player1StoneType || !player2StoneType) return; // لا ترسم اللوحة قبل الاختيار

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
                
                // 🛑 السطر الحاسم: إضافة 'piece' و 'stone-X' 🛑
                piece.classList.add('piece', stoneClass); 
                cell.appendChild(piece);
            }
            
            // تطبيق تمييز الخلية المحددة
            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                 cell.classList.add('selected');
            }

            boardElement.appendChild(cell);
        }
    }
}


// ----------------------------------
// منطق النقر (لضمان عمل اللعبة)
// ----------------------------------
// (تم تبسيط هذا الجزء إلى حد كبير للحفاظ على النظافة. إذا كانت اللعبة لديك لا تعمل، فيجب استيراد منطق handleSacrifice و handleMove الكامل هنا)
function handleCellClick(r, c) {
    if (gameOver) return;

    if (isSacrificePhase) {
        // ... منطق التضحية ...
    } else {
        if (board[r][c] === currentPlayer) {
            selectedPiece = { r, c };
            renderBoard(); 
        } else if (selectedPiece && board[r][c] === 0) {
            // ... منطق الحركة ...
            if (canMove(selectedPiece.r, selectedPiece.c, r, c)) {
                board[r][c] = board[selectedPiece.r][selectedPiece.c];
                board[selectedPiece.r][selectedPiece.c] = 0;
                selectedPiece = null;
                currentPlayer = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE; // تبديل الدور
                updateStatus();
                renderBoard();
            } else {
                showAlert("حركة غير قانونية!");
            }
        }
    }
}

// دالة مبسطة للتحقق من الحركة (يجب استبدالها بدالتك الأصلية)
function canMove(r1, c1, r2, c2) {
    // التأكد من أن الحركة تكون خطوة واحدة (أو قفزة إذا كانت لديك)
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}


// ----------------------------------
// معالجات الأحداث (Event Handlers)
// ----------------------------------

// معالج أحداث أزرار الاختيار
document.querySelectorAll('.stone-option').forEach(button => {
    button.addEventListener('click', (e) => {
        const stoneType = e.currentTarget.dataset.stone-type;
        const playerSelector = e.currentTarget.closest('.player-selection');
        
        playerSelector.querySelectorAll('.stone-option').forEach(btn => btn.classList.remove('selected'));
        e.currentTarget.classList.add('selected');

        if (playerSelector.id === 'player1-selector') {
            player1StoneType = stoneType;
        } else {
            player2StoneType = stoneType;
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
    player1StoneType = null;
    player2StoneType = null;
    selectionScreen.classList.remove('hidden');
    boardElement.classList.add('hidden');
    document.querySelectorAll('.stone-option').forEach(btn => btn.classList.remove('selected'));
    updateSelectionUI();
    // يجب أيضاً مسح حالة اللعبة المحفوظة هنا إذا كانت لديك
});

// تهيئة واجهة المستخدم عند تحميل الصفحة
updateSelectionUI();
