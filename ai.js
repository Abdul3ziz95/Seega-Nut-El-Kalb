
// ===================================
// منطق الذكاء الاصطناعي (AI) - Minimax Algorithm
// ===================================

// يجب أن تكون هذه المتغيرات متطابقة مع game.js
const AI_PLAYER = 2; // الكمبيوتر هو اللاعب 2 دائمًا
const BOARD_SIZE = 5;
const PLAYER1_PIECE = 1;
const PLAYER2_PIECE = 2;

// ------------------------------------
// 🧠 دالة تقييم الحالة (Heuristic Evaluation)
// ------------------------------------
function evaluateBoard(board, player) {
    let score = 0;
    let opponent = player === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

    let playerCount = 0;
    let opponentCount = 0;
    
    // قيمة كل قطعة
    const PIECE_VALUE = 1000;
    const MOBILITY_VALUE = 5; // قيمة لعدد الحركات المتاحة

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                playerCount++;
                if (window.getValidMoves(board, r, c, player).length > 0) { 
                    score += MOBILITY_VALUE;
                }
            } else if (board[r][c] === opponent) {
                opponentCount++;
                if (window.getValidMoves(board, r, c, opponent).length > 0) {
                     score -= MOBILITY_VALUE;
                }
            }
        }
    }

    score += (playerCount - opponentCount) * PIECE_VALUE;
    
    return score;
}

// ------------------------------------
// 🧭 دوال مساعدة لحساب الحركة
// ------------------------------------

// دالة تسترجع قائمة بحركات النط الممكنة من قطعة محددة
window.getJumpMoves = function(board, r, c, player) {
    const moves = [];
    const opponent = player === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
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
                moves.push({ r1: r, c1: c, r2: newR, c2: newC, capturedR: jumpedR, capturedC: jumpedC, isJump: true, isSacrifice: false });
            }
        }
    }
    return moves;
}


// دالة تسترجع جميع الحركات الممكنة لقطعة محددة
window.getValidMoves = function(board, r, c, player) {
    const moves = [];
    
    // 1. فحص الحركات بخطوة واحدة
    const singleSteps = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of singleSteps) {
        const newR = r + dr;
        const newC = c + dc;
        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === 0) {
            // حركة تضحية (يجب أن تكون إلى المركز فقط)
            if (window.isSacrificePhase && newR === 2 && newC === 2) { 
                 moves.push({ r1: r, c1: c, r2: newR, c2: newC, isJump: false, isSacrifice: true });
                 return moves; 
            }
            // حركة عادية
            if (!window.isSacrificePhase) {
                moves.push({ r1: r, c1: c, r2: newR, c2: newC, isJump: false, isSacrifice: false });
            }
        }
    }

    // 2. فحص حركات النط القاتل
    if (!window.isSacrificePhase) {
        const jumpMoves = window.getJumpMoves(board, r, c, player);
        moves.push(...jumpMoves);
    }
    
    return moves;
}

// دالة تسترجع جميع الحركات الممكنة للاعب الحالي
function getAllPossibleMoves(board, player) {
    let allMoves = [];
    let hasJumpMoves = false;
    
    if (window.isSacrificePhase) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === player) {
                     const moves = window.getValidMoves(board, r, c, player);
                     if (moves.length > 0) return moves; 
                }
            }
        }
        return []; 
    }
    
    // مرحلة اللعب العادية: ابحث عن النط أولاً
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                 const jumpMoves = window.getJumpMoves(board, r, c, player);
                 if (jumpMoves.length > 0) {
                     allMoves.push(...jumpMoves);
                     hasJumpMoves = true;
                 }
            }
        }
    }
    
    // إذا كان هناك أي نط، يجب تنفيذه.
    if (hasJumpMoves) {
        return allMoves;
    }
    
    // إذا لم يكن هناك نط، ابحث عن الحركات العادية
     for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                 const moves = window.getValidMoves(board, r, c, player);
                 moves.filter(m => !m.isJump).forEach(m => allMoves.push(m));
            }
        }
    }
    
    return allMoves;
}

// ------------------------------------
// ⚔️ خوارزمية Minimax
// ------------------------------------
function minimax(board, depth, isMaximizingPlayer, player, alpha, beta) {
    const MAX_DEPTH = 3; 
    
    const opponent = player === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

    if (depth === MAX_DEPTH || !window.canPlayerMove(player) || !window.canPlayerMove(opponent)) { 
        return evaluateBoard(board, player);
    }
    
    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        const possibleMoves = getAllPossibleMoves(board, player);
        
        for (const move of possibleMoves) {
            const newBoard = applyMove(board, move, player);
            const eval = minimax(newBoard, depth + 1, false, player, alpha, beta);
            maxEval = Math.max(maxEval, eval);
            alpha = Math.max(alpha, maxEval);
            if (beta <= alpha) break; 
        }
        return maxEval;
        
    } else { 
        let minEval = Infinity;
        const possibleMoves = getAllPossibleMoves(board, opponent);

        for (const move of possibleMoves) {
            const newBoard = applyMove(board, move, opponent);
            const eval = minimax(newBoard, depth + 1, true, player, alpha, beta);
            minEval = Math.min(minEval, eval);
            beta = Math.min(beta, minEval);
            if (beta <= alpha) break; 
        }
        return minEval;
    }
}

// ------------------------------------
// 🤖 دالة العثور على أفضل حركة للكمبيوتر
// ------------------------------------
function findBestMove(currentBoard, aiPlayer, aiDifficulty) {
    let depth;
    switch (aiDifficulty) {
        case 'easy':
            depth = 1;
            break;
        case 'medium':
            depth = 2; 
            break;
        case 'hard':
            depth = 3; 
            break;
        default:
            depth = 2;
    }
    
    const possibleMoves = getAllPossibleMoves(currentBoard, aiPlayer);
    let bestMove = null;
    let bestValue = -Infinity;
    
    possibleMoves.sort(() => Math.random() - 0.5); 

    for (const move of possibleMoves) {
        const newBoard = applyMove(currentBoard, move, aiPlayer);
        
        const moveValue = minimax(newBoard, 0, false, aiPlayer, -Infinity, Infinity); 

        if (moveValue > bestValue) {
            bestValue = moveValue;
            bestMove = move;
        }
    }
    
    return bestMove;
}

// ------------------------------------
// ⚙️ تطبيق الحركة على لوحة جديدة (لأغراض المحاكاة)
// ------------------------------------
function applyMove(currentBoard, move, player) {
    const newBoard = currentBoard.map(row => [...row]); 

    newBoard[move.r2][move.c2] = player;
    newBoard[move.r1][move.c1] = 0; 
    
    if (move.isJump) {
        newBoard[move.capturedR][move.capturedC] = 0;
    }

    return newBoard;
}

// ------------------------------------
// 📞 دالة استدعاء حركة الكمبيوتر
// ------------------------------------
window.triggerAIMove = function() {
    if (window.gameOver || window.currentPlayer !== AI_PLAYER) return;

    window.statusElement.textContent = "الكمبيوتر يفكر..."; 
    
    setTimeout(() => {
        let bestMove = findBestMove(window.board, AI_PLAYER, window.aiDifficulty);

        if (bestMove) {
            // 1. تطبيق الحركة المختارة مباشرة على لوحة اللعبة
            window.board[bestMove.r2][bestMove.c2] = AI_PLAYER;
            window.board[bestMove.r1][bestMove.c1] = 0;

            if (bestMove.isSacrifice) {
                window.isSacrificePhase = false;
                window.finishTurn();
                return;
            }

            if (bestMove.isJump) {
                window.board[bestMove.capturedR][bestMove.capturedC] = 0;
                
                // 2. التحقق من النط المتتالي
                if (window.canJumpAgain(bestMove.r2, bestMove.c2)) {
                    // إذا كان هناك نط متتالي، قم بتنفيذه
                    window.selectedPiece = { r: bestMove.r2, c: bestMove.c2 };
                    window.canChainJump = true; 
                    window.renderBoard();
                    window.updateStatus();
                    // استدعاء الكمبيوتر مرة أخرى للحركة المتتالية
                    setTimeout(window.triggerAIMove, 500); 
                    return; 
                }
            }
            
            // 3. إنهاء الدور إذا لم يكن نط متتالي
            window.finishTurn();
            
        } else {
             // إذا لم يجد الكمبيوتر حركة، فإن الدور ينتقل.
             window.finishTurn(); 
        }
    }, 1000); // انتظر ثانية واحدة قبل حركة الكمبيوتر 
}
