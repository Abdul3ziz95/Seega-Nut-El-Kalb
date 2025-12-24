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
const GAME_STATE_KEY = 'nutElKalbGameState'; 

// متغيرات النط المتتالي 🛑 (إضافات ميزة القفز المتسلسل) 🛑
let canChainJump = false; 
let chainJumpTimer = null; 
const CHAIN_JUMP_TIME = 2000; // 2 ثانية

let board = []; 
let currentPlayer = 0; 
let selectedPiece = null; 
let isSacrificePhase = true; 
let gameOver = false;


// دوال التحكم والتنبيه
function showAlert(message) {
    alertMessage.textContent = message;
    alertOverlay.classList.remove('hidden');
}

alertButton.addEventListener('click', () => {
    alertOverlay.classList.add('hidden');
});

function updateStatus() {
    if (gameOver) {
        const winner = currentPlayer === PLAYER1_PIECE ? 'الأسود' : 'الأحمر';
        statusElement.textContent = `انتهت اللعبة! الفائز هو اللاعب ${winner}.`;
        return;
    }
    const playerColor = currentPlayer === PLAYER1_PIECE ? 'الأسود' : 'الأحمر';
    
    // 🛑 تحديث شريط الحالة ليعكس فترة القفز المتسلسل 🛑
    if (canChainJump) {
        statusElement.textContent = `دور اللاعب ${playerColor}. لديك فرصة نط متتالٍ (ثانيتان).`;
    } else if (isSacrificePhase) {
        statusElement.textContent = `دور اللاعب ${playerColor}. اختر قطعة للتضحية بها (إزالتها).`;
    } else {
        statusElement.textContent = `دور اللاعب ${playerColor}. اختر قطعة للحركة.`;
    }
}

function initializeBoard() {
    // إعداد اللوحة الافتراضي
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
    
    // وضع قطع اللاعب الأول في الأماكن الافتراضية
    const p1Starts = [[0,1], [0,2], [0,3], [1,0], [1,1], [1,2], [1,3], [1,4], [2,0], [3,1]];
    p1Starts.forEach(([r, c]) => board[r][c] = PLAYER1_PIECE);
    
    // وضع قطع اللاعب الثاني في الأماكن الافتراضية
    const p2Starts = [[4,1], [4,2], [4,3], [3,0], [3,1], [3,2], [3,3], [3,4], [2,4], [1,3]];
    p2Starts.forEach(([r, c]) => board[r][c] = PLAYER2_PIECE);
    
    // إعدادات البداية
    currentPlayer = PLAYER1_PIECE;
    isSacrificePhase = true;
    gameOver = false;
    selectedPiece = null;
    canChainJump = false;
    
    updateStatus();
    renderBoard();
    // loadGameState(); // يمكنك تفعيل هذه الدالة لاحقاً
}

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
                
                if (pieceType === PLAYER1_PIECE) {
                    piece.classList.add('player1');
                } else {
                    piece.classList.add('player2');
                }
                
                piece.classList.add('piece');
                cell.appendChild(piece);
            }
            
            // تمييز القطعة المختارة
            if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                 cell.classList.add('selected');
            }

            boardElement.appendChild(cell);
        }
    }
}

// ----------------------------------
// منطق التحقق من الحركة (يشمل القفز)
// ----------------------------------

function canMove(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);

    // الحركة العادية: خطوة واحدة أفقياً أو عمودياً
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        return { type: 'move' };
    }

    // القفز (القتل): خطوتان أفقياً أو عمودياً
    if ((dr === 2 && dc === 0) || (dr === 0 && dc === 2)) {
        // تحديد الخانة الوسطى التي يتم القفز فوقها
        const middleR = r1 + (r2 - r1) / 2;
        const middleC = c1 + (c2 - c1) / 2;

        // يجب أن تكون الخانة الوسطى تحتوي على قطعة الخصم
        const opponent = currentPlayer === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
        if (board[middleR][middleC] === opponent) {
            return { type: 'jump', middleR, middleC };
        }
    }
    return { type: 'invalid' };
}

// ----------------------------------
// الدالة الرئيسية لمعالجة النقر على الخلية (تطبيق منطق القفز المتسلسل)
// ----------------------------------
function handleCellClick(r, c) {
    if (gameOver) return;

    if (isSacrificePhase) {
        // منطق التضحية
        if (board[r][c] !== 0 && board[r][c] !== currentPlayer) {
            board[r][c] = 0; // إزالة القطعة
            isSacrificePhase = false; 
            updateStatus();
            renderBoard();
        } else {
             showAlert("يجب أن تضحي بقطعة من قطع الخصم!");
        }
        return;
    }
    
