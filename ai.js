// ===================================
// منطق اللعب ضد الكمبيوتر (AI)
// ===================================

const AI_PLAYER = 2; 
const OPPONENT_PLAYER = 1; 

// ------------------------------------
// 🤖 دالة بدء حركة الكمبيوتر (تُستدعى من game.js)
// ------------------------------------

async function triggerAIMove() {
    // حماية ضد استدعاء الحركة في غير دور الكمبيوتر
    if (currentPlayer !== AI_PLAYER) return; 
    
    // تأخير صغير لمحاكاة تفكير الكمبيوتر
    await new Promise(resolve => setTimeout(resolve, 800)); 
    
    let currentMove = null;
    let currentBoard = board.map(row => [...row]); 
    const allLegalMoves = getAllLegalMoves(currentBoard, AI_PLAYER, isSacrificePhase);

    if (allLegalMoves.length === 0) {
        finishTurn(false); // الكمبيوتر لا يستطيع الحركة
        return;
    }

    // 1. اختيار الحركة بناءً على الصعوبة
    if (isSacrificePhase) {
        currentMove = allLegalMoves[0]; 
    } else {
        switch (aiDifficulty) {
            case 'EASY':
                currentMove = selectEasyMove(allLegalMoves);
                break;
            case 'MEDIUM':
                currentMove = selectMediumMove(allLegalMoves);
                break;
            case 'HARD':
                currentMove = selectHardMove(currentBoard, allLegalMoves);
                break;
            default:
                currentMove = selectEasyMove(allLegalMoves);
        }
    }

    if (currentMove) {
        // 2. تطبيق الحركة (بشكل مباشر على اللوحة)
        board[currentMove.r2][currentMove.c2] = AI_PLAYER;
        board[currentMove.r1][currentMove.c1] = 0;
        
        if (currentMove.isSacrifice) {
            isSacrificePhase = false;
        }

        if (currentMove.isJump) {
            board[currentMove.capturedR][currentMove.capturedC] = 0;
            
            // 3. معالجة النط المتتالي (AI يقوم به تلقائياً)
            let pieceR = currentMove.r2;
            let pieceC = currentMove.c2;
            
            while (canJumpAgain(pieceR, pieceC)) {
                await new Promise(resolve => setTimeout(resolve, 500)); 
                
                const chainMoves = getAllLegalMoves(board, AI_PLAYER, false).filter(m => m.r1 === pieceR && m.isJump);
                
                // اختيار أفضل نط متتالي بناءً على الصعوبة
                const nextJump = selectHardMove(board, chainMoves) || chainMoves[0]; 
                
                if (nextJump) {
                    board[nextJump.r2][nextJump.c2] = AI_PLAYER;
                    board[nextJump.r1][nextJump.c1] = 0;
                    board[nextJump.capturedR][nextJump.capturedC] = 0;
                    
                    pieceR = nextJump.r2;
                    pieceC = nextJump.c2;
                    
                    renderBoard();
                } else {
                    break;
                }
            }
        }
        
        finishTurn(false); // إنهاء الدور وتمريره للاعب الآخر
    }
}

// ------------------------------------
// 🟢 سهل: حركة عشوائية صحيحة
// ------------------------------------
function selectEasyMove(legalMoves) {
    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[randomIndex];
}

// ------------------------------------
// 🟡 متوسط: يفضل الأكل
// ------------------------------------
function selectMediumMove(legalMoves) {
    const jumpMoves = legalMoves.filter(move => move.isJump);
    
    if (jumpMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * jumpMoves.length);
        return jumpMoves[randomIndex];
    }
    
    return selectEasyMove(legalMoves);
}

// ------------------------------------
// 🔴 صعب: استخدام خوارزمية Minimax بسيطة
// ------------------------------------
function selectHardMove(currentBoard, legalMoves) {
    let bestMove = null;
    let bestScore = -Infinity;
    const DEPTH = 2; // عمق البحث: 2 حركة

    for (const move of legalMoves) {
        const newBoard = simulateMove(currentBoard, move);
        
        // تطبيق Minimax
        const score = minimax(newBoard, DEPTH - 1, false, AI_PLAYER, -Infinity, Infinity); 
            
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove || selectMediumMove(legalMoves);
}

// ------------------------------------
// ⚙️ دوال مساعدة لـ AI (Minimax)
// ------------------------------------

// دالة تقييم اللوحة (كلما زاد الرقم، كان أفضل لـ AI)
function evaluateBoard(board, player) {
    let score = 0;
    let ownPieces = 0;
    let oppPieces = 0;
    const opponent = player === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                ownPieces++;
            } else if (board[r][c] === opponent) {
                oppPieces++;
            }
        }
    }
    
    // تقييم بسيط: الفرق في عدد القطع
    score += (ownPieces - oppPieces) * 100;
    
    // مكافأة التحكم في المركز
    if (board[CENTER_R][CENTER_C] === player) {
        score += 50;
    }

    return score;
}

// خوارزمية Minimax (مع Alpha-Beta Pruning)
function minimax(board, depth, isMaximizingPlayer, player, alpha, beta) {
    if (depth === 0) {
        return evaluateBoard(board, AI_PLAYER);
    }
    
    const opponent = player === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
    const moves = getAllLegalMoves(board, isMaximizingPlayer ? AI_PLAYER : opponent, false);

    if (moves.length === 0) {
        // نهاية اللعبة أو جمود
        return evaluateBoard(board, AI_PLAYER);
    }

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const newBoard = simulateMove(board, move);
            const evaluation = minimax(newBoard, depth - 1, false, player, alpha, beta);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, maxEval);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = +Infinity;
        for (const move of moves) {
            const newBoard = simulateMove(board, move);
            const evaluation = minimax(newBoard, depth - 1, true, player, alpha, beta);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, minEval);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

// دالة محاكاة الحركة
function simulateMove(currentBoard, move) {
    const newBoard = currentBoard.map(row => [...row]);
    const piece = newBoard[move.r1][move.c1];
    newBoard[move.r2][move.c2] = piece;
    newBoard[move.r1][move.c1] = 0;
    if (move.isJump) {
        newBoard[move.capturedR][move.capturedC] = 0;
    }
    return newBoard;
}

// دالة الحصول على جميع الحركات القانونية (مشتقة من canMove)
function getAllLegalMoves(currentBoard, player, isSacrificePhase) {
    const legalMoves = [];
    const opponent = player === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (currentBoard[r][c] === player) {
                
                // 🎯 مرحلة التضحية
                if (isSacrificePhase) {
                    if (r !== CENTER_R && c !== CENTER_C && board[CENTER_R][CENTER_C] === 0) {
                        legalMoves.push({
                            r1: r, c1: c, r2: CENTER_R, c2: CENTER_C, isSacrifice: true
                        });
                        // نكتفي بحركة واحدة في هذه المرحلة
                        return legalMoves;
                    }
                }

                // 🎯 مرحلة اللعب العادية
                const singleSteps = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                for (const [dr, dc] of singleSteps) {
                    const newR = r + dr;
                    const newC = c + dc;
                    if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && currentBoard[newR][newC] === 0) {
                        legalMoves.push({
                            r1: r, c1: c, r2: newR, c2: newC, isJump: false
                        });
                    }
                }
                
                const doubleSteps = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [2, -2], [-2, 2], [-2, -2]];
                for (const [dr, dc] of doubleSteps) {
                    const newR = r + dr;
                    const newC = c + dc;
                    if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && currentBoard[newR][newC] === 0) {
                        const jumpedR = r + Math.floor(dr / 2);
                        const jumpedC = c + Math.floor(dc / 2);
                        
                        if (currentBoard[jumpedR][jumpedC] === opponent) {
                            legalMoves.push({
                                r1: r, c1: c, r2: newR, c2: newC, isJump: true,
                                capturedR: jumpedR, capturedC: jumpedC
                            });
                        }
                    }
                }
            }
        }
    }
    return legalMoves;
}
