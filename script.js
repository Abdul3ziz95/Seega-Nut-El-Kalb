
// ... (داخل دالة renderBoard في ملف script.js) ...
function renderBoard() {
    boardElement.innerHTML = ''; 
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            // ... (إنشاء الخلية) ...

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
                
                // 🛑 هذه الخطوة تضيف الكلاسات playerX و stone-X إلى القطعة 🛑
                piece.classList.add('piece', stoneClass); 
                cell.appendChild(piece);
            }
            
            // ... (إضافة كلاس 'selected' وتذييل) ...
        }
    }
}
// ...
