
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
    
    // قيمة كل قطعة (يمكن تعديلها لزيادة أو تقليل العدوانية)
    const PIECE_VALUE = 1000;
    const MOBILITY_VALUE = 5; // قيمة لعدد الحركات المتاحة

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                playerCount++;
                // مكافأة الحركات الممكنة للـ AI
                if (getValidMoves(board, r, c, player).length > 0) {
                    score += MOBILITY_VALUE;
                }
            } else if (board[r][c] === opponent) {
                opponentCount++;
                // عقاب الحركات الممكنة للخصم
                if (getValidMoves(board, r, c, opponent).length > 0) {
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
function getJumpMoves(board, r, c, player) {
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
function getValidMoves(board, r, c, player) {
    const moves = [];
    const opponent = player === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;
    
    // 1. فحص الحركات بخطوة واحدة (أفقي/عمودي فقط)
    const singleSteps = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of singleSteps) {
        const newR = r + dr;
        const newC = c + dc;
        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === 0) {
            // حركة تضحية (يجب أن تكون إلى المركز فقط)
            if (window.isSacrificePhase && newR === 2 && newC === 2) { 
                 moves.push({ r1: r, c1: c, r2: newR, c2: newC, isJump: false, isSacrifice: true });
                 return moves; // التضحية هي الحركة الوحيدة المسموحة
            }
            // حركة عادية (ليست نط)
            if (!window.isSacrificePhase) {
                moves.push({ r1: r, c1: c, r2: newR, c2: newC, isJump: false, isSacrifice: false });
            }
        }
    }

    // 2. فحص حركات النط القاتل (خطوتين - جميع الاتجاهات)
    if (!window.isSacrificePhase) {
        const jumpMoves = getJumpMoves(board, r, c, player);
        moves.push(...jumpMoves);
    }
    
    return moves;
}

// دالة تسترجع جميع الحركات الممكنة للاعب الحالي
function getAllPossibleMoves(board, player) {
    let allMoves = [];
    let hasJumpMoves = false;
    
    // إذا كانت مرحلة التضحية، ابحث عن قطعة يمكنها التضحية
    if (window.isSacrificePhase) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === player) {
                     const moves = getValidMoves(board, r, c, player);
                     if (moves.length > 0) return moves; // إذا وجدنا تضحية واحدة، نكتفي بها
                }
            }
        }
    }
    
    // مرحلة اللعب العادية: ابحث عن كل الحركات، وابحث عن النط أولاً
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                 const jumpMoves = getJumpMoves(board, r, c, player);
                 if (jumpMoves.length > 0) {
                     allMoves.push(...jumpMoves);
                     hasJumpMoves = true;
                 }
            }
        }
    }
    
    // إذا كان هناك أي نط، يجب على اللاعب تنفيذه.
    if (hasJumpMoves) {
        return allMoves;
    }
    
    // إذا لم يكن هناك نط، ابحث عن الحركات العادية
     for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                 const moves = getValidMoves(board, r, c, player);
                 // أضف الحركات العادية فقط إذا لم تكن نط
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
    // 🛑 عمق البحث (يمكن تغييره لزيادة الصعوبة)
    const MAX_DEPTH = 3; 
    
    const opponent = player === PLAYER1_PIECE ? PLAYER2_PIECE : PLAYER1_PIECE;

    if (depth === MAX_DEPTH || !canPlayerMove(player) || !canPlayerMove(opponent)) {
        return evaluateBoard(board, player);
    }
    
    // اللاعب الحالي هو AI_PLAYER (تعظيم النتيجة)
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
        
    // اللاعب الحالي هو الخصم (تقليل النتيجة)
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
    // تعيين عمق البحث بناءً على الصعوبة
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
    
    // التوزيع العشوائي للحركات في نفس التقييم (لمنع تكرار اللعب)
    possibleMoves.sort(() => Math.random() - 0.5); 

    for (const move of possibleMoves) {
        const newBoard = applyMove(currentBoard, move, aiPlayer);
        
        // هنا نستخدم عمق البحث المحدد
        const moveValue = minimax(newBoard, 0, false, aiPlayer, -Infinity, Infinity); 

        if (moveValue > bestValue) {
            bestValue = moveValue;
            bestMove = move;
        }
    }
    
    // إذا كانت هناك حركات نط متتالي، يجب أن تتم معالجتها خارج هذه الدالة
    // سنعيد أفضل حركة أولاً.
    return bestMove;
}

// ------------------------------------
// ⚙️ تطبيق الحركة على لوحة جديدة (لأغراض المحاكاة)
// ------------------------------------
function applyMove(currentBoard, move, player) {
    // نسخ اللوحة لعدم تعديل اللوحة الأصلية
    const newBoard = currentBoard.map(row => [...row]); 

    // تطبيق الحركة
    newBoard[move.r2][move.c2] = player;
    newBoard[move.r1][move.c1] = 0; 
    
    if (move.isSacrifice) {
        // لا يوجد أسر
    } else if (move.isJump) {
        // إزالة القطعة المأسورة
        newBoard[move.capturedR][move.capturedC] = 0;
    }

    return newBoard;
}

// ------------------------------------
// 📞 دالة استدعاء حركة الكمبيوتر
// ------------------------------------
function triggerAIMove() {
    if (window.gameOver || window.currentPlayer !== AI_PLAYER) return;

    // تعطيل واجهة المستخدم أثناء تفكير الكمبيوتر
    window.statusElement.textContent = "الكمبيوتر يفكر..."; 
    
    // تحديد عمق البحث المناسب
    let currentDepth = window.aiDifficulty === 'easy' ? 1 : (window.aiDifficulty === 'hard' ? 3 : 2);
    
    // استخدام مهلة لتمكين تحديث الواجهة والانتظار قليلاً (مهم)
    setTimeout(() => {
        let bestMove = findBestMove(window.board, AI_PLAYER, window.aiDifficulty);

        if (bestMove) {
            // 1. تطبيق الحركة المختارة
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
                    // (تتم معالجة النط المتتالي تلقائيًا داخل triggerAIMove)
                    setTimeout(triggerAIMove, 500); // مهلة أقصر للنط المتتالي
                    return; 
                }
            }
            
            // 3. إنهاء الدور إذا لم يكن نط متتالي
            window.finishTurn();
            
        } else {
             // إذا لم يجد الكمبيوتر حركة، فإن الدور ينتقل.
             window.finishTurn(); 
        }
    }, 1000); // انتظر ثانية واحدة قبل حركة الكمبيوتر (لتبدو واقعية)
}

