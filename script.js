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
const selectionScreen = document.getElementById('selection-screen'); // 🛑 عنصر شاشة الاختيار
const startGameButton = document.getElementById('start-game-button'); // 🛑 زر بدء اللعب
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

// متغيرات النط المتتالي
let canChainJump = false; 
let chainJumpTimer = null; 
const CHAIN_JUMP_TIME = 2000; 

let board = []; 
let currentPlayer = 0; 
let selectedPiece = null; 
let isSacrificePhase = true; 
let gameOver = false;

// 🛑 متغيرات اختيار الحجارة 🛑
let player1StoneType = null;
let player2StoneType = null;
const ALL_STONE_TYPES = ['A', 'B', 'C', 'D', 'E']; 

// دالة عرض التنبيه المخصص
function showAlert(message) {
    alertMessage.textContent = message;
    alertOverlay.classList.remove('hidden');
    alertButton.onclick = () => {
        alertOverlay.classList.add('hidden');
    };
}


// 🛑 حفظ حالة اللعبة إلى التخزين المحلي
function saveGameState() {
    const state = {
        board: board,
        currentPlayer: currentPlayer,
        selectedPiece: selectedPiece,
        isSacrificePhase: isSacrificePhase,
        gameOver: gameOver,
        // 🛑 حفظ نوع الحجر 🛑
        player1StoneType: player1StoneType,
        player2StoneType: player2StoneType
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
}

// 🛑 تحميل حالة اللعبة من التخزين المحلي
function loadGameState() {
    const savedState = localStorage.getItem(GAME_STATE_KEY);
    if (savedState) {
        const state = JSON.parse(savedState);
        board = state.board;
        currentPlayer = state.currentPlayer;
        selectedPiece = state.selectedPiece;
        isSacrificePhase = state.isSacrificePhase;
        gameOver = state.gameOver;
        // 🛑 تحميل نوع الحجر 🛑
        player1StoneType = state.player1StoneType;
        player2StoneType = state.player2StoneType;
        
        canChainJump = false; 
        if (chainJumpTimer) clearTimeout(chainJumpTimer);
        chainJumpTimer = null;
        
        return true;
    }
    return false;
}

// 1. تهيئة اللوحة (تم تعديلها لتشمل شاشة الاختيار)
function initializeBoard() {
    const loaded = loadGameState();
    
    // 1. إذا كانت حالة اللعبة موجودة وتم اختيار الأنماط، ابدأ اللعبة مباشرة
    if (loaded && board.length > 0 && player1StoneType && player2StoneType) {
        selectionScreen.classList.add('hidden');
        boardElement.classList.remove('hidden');
        renderBoard();
        updateStatus();
        return; 
    }
    
    // 2. إذا لم يتم اختيار الأنماط (لعبة جديدة أو إعادة تعيين)، اعرض شاشة الاختيار
    if (!player1StoneType || !player2StoneType) {
        setupSelectionScreen();
        return;
    }

    // ------------------------------------
    // 3. بدء لعبة جديدة (تصل هنا فقط إذا كانت الأنماط مختارة ولكن لا يوجد حالة لعب سابقة)
    // ------------------------------------
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

    currentPlayer = Math.random() < 0.5 ? PLAYER1_PIECE : PLAYER2_PIECE;

    saveGameState(); 
    renderBoard();
    updateStatus();
    
    selectionScreen.classList.add('hidden');
    boardElement.classList.remove('hidden');
}


// 🛑 دالة إعداد شاشة الاختيار 🛑
function setupSelectionScreen() {
    selectionScreen.classList.remove('hidden');
    boardElement.classList.add('hidden');
    
    const options = document.querySelectorAll('.stone-option');
    options.forEach(option => {
        // إزالة المستمعين القدامى لمنع تكرار الأحداث
        option.removeEventListener('click', handleStoneSelection); 
        option.addEventListener('click', handleStoneSelection);
    });

    startGameButton.removeEventListener('click', initializeBoard);
    startGameButton.addEventListener('click', () => {
        if (player1StoneType && player2StoneType) {
            initializeBoard(); // ابدأ اللعبة الآن
        }
    });

    // تحديث حالة الأزرار بناءً على الاختيارات المحفوظة
    updateSelectionUI();
}

// 🛑 دالة التعامل مع اختيار الحجارة 🛑
function handleStoneSelection(event) {
    const selectedButton = event.currentTarget;
    const type = selectedButton.dataset.stoneType;
    const isPlayer1 = selectedButton.closest('#player1-selector');

    let currentChoice;

    if (isPlayer1) {
        currentChoice = player1StoneType;
    } else {
        currentChoice = player2StoneType;
    }
    
    if (currentChoice === type) {
        if (isPlayer1 && player2StoneType !== type) {
             player1StoneType = null;
        } else if (!isPlayer1 && player1StoneType !== type) {
             player2StoneType = null;
        }
    } else {
        if (isPlayer1) {
            if (player2StoneType !== type) {
                player1StoneType = type;
            } else {
                showAlert('اللاعب الأحمر اختار هذا النوع بالفعل!');
            }
        } else {
            if (player1StoneType !== type) {
                player2StoneType = type;
            } else {
                showAlert('اللاعب الأسود اختار هذا النوع بالفعل!');
            }
        }
    }
    
    updateSelectionUI();
}

// 🛑 تحديث واجهة الاختيار (تمكين/تعطيل الأزرار وتحديث النص) 🛑
function updateSelectionUI() {
    // 1. تحديث حالة الأزرار
    document.querySelectorAll('.stone-option').forEach(btn => {
        const type = btn.dataset.stoneType;
        const isPlayer1 = btn.closest('#player1-selector');
        
        btn.classList.remove('selected', 'disabled-by-opponent');

        if (isPlayer1) {
            if (player1StoneType === type) {
                btn.classList.add('selected');
            } else if (player2StoneType === type) {
                btn.classList.add('disabled-by-opponent');
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        } else {
            if (player2StoneType === type) {
                btn.classList.add('selected');
            } else if (player1StoneType === type) {
                btn.classList.add('disabled-by-opponent');
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        }
    });

    // 2. تحديث نص حالة الاختيار
    document.getElementById('p1-choice-status').textContent = player1StoneType ? `تم اختيار حجر: ${player1StoneType}` : 'لم يتم الاختيار بعد.';
    document.getElementById('p2-choice-status').textContent = player2StoneType ? `تم اختيار حجر: ${player2StoneType}` : 'لم يتم الاختيار بعد.';

    // 3. تفعيل زر البدء
    if (player1StoneType && player2StoneType) {
        startGameButton.disabled = false;
    } else {
        startGameButton.disabled = true;
    }
    
    saveGameState(); // حفظ الاختيارات
}


// عرض اللوحة في HTML (تم تعديلها لتطبيق نمط الحجر)
function renderBoard() {
    boardElement.innerHTML = ''; 
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            
            // ... (منطق تلوين الخلية) ...
            if ((r + c) % 2 === 0) {
                 cell.classList.add('cell', 'cell-even');
            } else {
                 cell.classList.add('cell', 'cell-odd');
            }

            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', handleCellClick);

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
                
                piece.classList.add('piece', stoneClass); // إضافة كلاس النمط
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


// دالة تحديث حالة اللعبة (من قام بالتضحية، دور من؟)
function updateStatus() {
    let status = '';
    const playerColor = currentPlayer === PLAYER1_PIECE ? 'الأسود' : 'الأحمر';
    const playerStyle = currentPlayer === PLAYER1_PIECE ? 'player1-status' : 'player2-status';

    if (gameOver) {
        const winner = currentPlayer === PLAYER1_PIECE ? 'الأحمر' : 'الأسود';
        status = `انتهت اللعبة! الفائز هو اللاعب ${winner}.`;
    } else if (isSacrificePhase) {
        status = `الدور على اللاعب ${playerColor}. اختر قطعة لتضحي بها.`;
    } else {
        status = `الدور على اللاعب <span class="${playerStyle}">${playerColor}</span>. اختر قطعة للتحرك أو النط.`;
        if (canChainJump) {
            status += ' ⚠️ نط متتالي إضافي (خلال ثانيتين).';
        }
    }
    statusElement.innerHTML = status;
}

// ... (بقية دوال اللعبة: canMove, canJumpAgain, getPossibleJumps, getPieceCount, checkWin, handleCellClick) ...
// بما أنك لم تطلب تعديلها، لن أدرجها، لكن تأكد من وجودها في ملف script.js لديك.


// دالة إنهاء الدور (لتبديل اللاعب)
function finishTurn(skipPlayerChange = false) {
    // ... (هنا باقي منطق الدالة كما هو في ملفك) ...
}

// دالة التحقق من إمكانية تحرك اللاعب (لمنع الجمود)
function canPlayerMove(player) {
    // ... (هنا باقي منطق الدالة كما هو في ملفك) ...
    return true; 
}


// 🛑 مسح حالة الحفظ وبدء لعبة جديدة
resetButton.addEventListener('click', () => {
    localStorage.removeItem(GAME_STATE_KEY);
    // إعادة تعيين أنماط الحجر والبدء من شاشة الاختيار
    player1StoneType = null;
    player2StoneType = null;
    initializeBoard(); 
});


// بدء اللعبة عند التحميل
initializeBoard();

