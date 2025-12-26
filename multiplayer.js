// ===================================
// منطق اللعب عبر الإنترنت (Multiplayer)
// ===================================

let peer = null;
let connection = null;
let isHost = false; 

const peerStatusEl = document.getElementById('peer-status');
const connectionMessageEl = document.getElementById('connection-message');


// تهيئة PeerJS (تُستدعى من game.js)
function initializePeer() {
    connectionMessageEl.textContent = 'جارٍ الاتصال بخادم PeerJS...';
    
    if (peer) {
        peer.destroy();
    }
    
    // استخدام خادم PeerJS المجاني الافتراضي (P2P)
    peer = new Peer({
        host: '0.peerjs.com', 
        port: 443, 
        secure: true
    }); 

    peer.on('open', (id) => {
        myIdDisplayEl.textContent = id;
        peerStatusEl.textContent = 'الشبكة جاهزة. شارك معرّفك أو اتصل بالخصم.';
        connectionMessageEl.textContent = '';
    });

    // الاستماع للاتصالات الواردة (هذا هو دور المضيف/اللاعب الأول)
    peer.on('connection', (conn) => {
        connection = conn;
        isHost = true;
        
        connectionMessageEl.textContent = `تم قبول اتصال من: ${conn.peer}`;
        setupConnectionListeners(connection);
    });
    
    peer.on('error', (err) => {
        connectionMessageEl.textContent = `خطأ في الاتصال بالشبكة: ${err.type}. حاول تحديث الصفحة.`;
    });
}

// الاتصال بمعرّف الخصم
function connectToPeer(peerId) {
    if (!peerId || peerId === myIdDisplayEl.textContent) {
        connectionMessageEl.textContent = "الرجاء إدخال معرّف خصم صحيح ومختلف عن معرّفك.";
        return;
    }
    
    connectionMessageEl.textContent = `جارٍ محاولة الاتصال بـ ${peerId}...`;
    
    // إنشاء اتصال صادر (هذا هو دور الضيف/اللاعب الثاني)
    connection = peer.connect(peerId);
    isHost = false;

    setupConnectionListeners(connection);
}


function setupConnectionListeners(conn) {
    conn.on('open', () => {
        connectionMessageEl.textContent = `تم الاتصال بنجاح. ابدأ اللعب!`;
        
        if (isHost) {
            // المضيف يبدأ اللعبة كـ PLAYER1
            startGame('ONLINE', PLAYER1_PIECE); 
            // يرسل إشارة البدء ورقم اللاعب للخصم (الذي سيكون PLAYER2)
            connection.send({ 
                type: 'GAME_START', 
                playerNumber: PLAYER2_PIECE 
            });
        }
    });

    conn.on('data', (data) => {
        handleIncomingData(data);
    });

    conn.on('close', () => {
        connectionMessageEl.textContent = "انقطع الاتصال بالخصم!";
        alert("انقطع الاتصال بالخصم. الرجاء العودة إلى القائمة الرئيسية.");
        // العودة للقائمة الرئيسية (موجودة في game.js)
        showMainMenu();
    });
}

// معالجة البيانات الواردة
function handleIncomingData(data) {
    switch (data.type) {
        case 'MOVE':
            // تطبيق الحركة (موجودة في game.js)
            applyOpponentMove(data.move); 
            break;
            
        case 'GAME_START':
            if (!isHost) {
                 // الضيف يبدأ اللعبة عندما تصله إشارة من المضيف
                 startGame('ONLINE', data.playerNumber);
                 showScreen('game-container');
            }
            break;
            
        case 'FINISH_TURN':
             // لإنهاء دور الخصم في حالة النط المتتالي
             finishTurn(false);
            break;

        default:
            console.warn('Unknown data type received:', data.type);
            break;
    }
}

// 📤 إرسال الحركة (تُستدعى من game.js)
function sendMoveData(move) {
    if (connection && connection.open) {
        connection.send({
            type: 'MOVE',
            move: move
        });
    }
}

// 📤 إرسال إشارة إنهاء الدور (تُستدعى من game.js)
function sendFinishTurnSignal() {
    if (connection && connection.open) {
        connection.send({
            type: 'FINISH_TURN'
        });
    }
}

// إغلاق PeerJS (تُستدعى عند العودة للقائمة الرئيسية)
function destroyPeer() {
    if (peer) {
        peer.destroy();
        peer = null;
    }
}
