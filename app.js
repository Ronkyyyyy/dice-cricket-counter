document.addEventListener('DOMContentLoaded', () => {

    // --- 設定値 ---
    const TARGET_AREAS = ['11', '9', '7', '5', '3', '1', 'bull']; // クライミングしやすいよう上から配置
    const BULL_VALUE = 15;
    const MARK_SYMBOLS = ['', '／', '✕', '◎'];

    // --- 状態管理 ---
    let currentState = {
        board: {
            p1: {}, // { '11': 0, ... 'bull': 0 }
            p2: {}
        },
        scores: {
            p1: {}, // { '11': 0, ... '15': 0 }
            p2: {}
        },
        log: {
            p1: 'ゲーム開始',
            p2: 'ゲーム開始'
        }
    };

    // Undo用の履歴スタック
    let historyStack = [];

    // --- DOM要素取得 ---
    const p1RowsContainer = document.getElementById('p1-rows');
    const p2RowsContainer = document.getElementById('p2-rows');
    const p1TotalDisplay = document.getElementById('p1-total-score');
    const p2TotalDisplay = document.getElementById('p2-total-score');
    const p1LogBox = document.getElementById('p1-history');
    const p2LogBox = document.getElementById('p2-history');
    const btnUndo = document.getElementById('btn-undo');
    const btnReset = document.getElementById('btn-reset');
    
    // モーダル
    const gameOverModal = document.getElementById('game-over-modal');
    const winnerAnnouncement = document.getElementById('winner-announcement');
    const finalResults = document.getElementById('final-results');
    const btnModalClose = document.getElementById('btn-modal-close');

    // --- 初期化 ---
    function init() {
        TARGET_AREAS.forEach(area => {
            currentState.board.p1[area] = 0;
            currentState.board.p2[area] = 0;

            const scoreKey = (area === 'bull') ? BULL_VALUE : parseInt(area);
            currentState.scores.p1[scoreKey] = 0;
            currentState.scores.p2[scoreKey] = 0;
        });
        historyStack = [];
        buildRows();
        updateUI();
    }

    // 各マスの行を動的生成
    function buildRows() {
        p1RowsContainer.innerHTML = '';
        p2RowsContainer.innerHTML = '';

        TARGET_AREAS.forEach(area => {
            p1RowsContainer.appendChild(createCounterRow(1, area));
            p2RowsContainer.appendChild(createCounterRow(2, area));
        });
    }

    function createCounterRow(player, area) {
        const row = document.createElement('div');
        row.classList.add('counter-row');
        row.dataset.area = area;

        const labelName = (area === 'bull') ? 'Bull' : area;
        const labelSub = (area === 'bull') ? `(${BULL_VALUE})` : '';

        row.innerHTML = `
            <div class="target-label">${labelName}<small>${labelSub}</small></div>
            <div class="mark-status-box"></div>
            <button class="btn-add-mark">＋</button>
        `;

        // タップイベント
        row.querySelector('.btn-add-mark').addEventListener('click', () => {
            pushToHistory(); // 実行前に今の状態を退避
            addMark(player, area);
        });

        return row;
    }

    // --- カウンターコアロジック ---
    function addMark(player, area) {
        const myBoard = (player === 1) ? currentState.board.p1 : currentState.board.p2;
        const oppBoard = (player === 1) ? currentState.board.p2 : currentState.board.p1;
        const myScores = (player === 1) ? currentState.scores.p1 : currentState.scores.p2;
        const scoreKey = (area === 'bull') ? BULL_VALUE : parseInt(area);

        const isMyClosed = myBoard[area] === 3;
        const isOppClosed = oppBoard[area] === 3;
        const logName = (area === 'bull') ? 'ブル' : area;

        if (!isMyClosed) {
            // マーカーを加算
            myBoard[area]++;
            if (myBoard[area] === 3) {
                currentState.log[`p${player}`] = `${logName} をクローズしました！`;
            } else {
                currentState.log[`p${player}`] = `${logName} に 1マーク追加 (${MARK_SYMBOLS[myBoard[area]]})`;
            }
        } else {
            // クローズ済みの場合、相手が未クローズならアタック（得点）
            if (!isOppClosed) {
                myScores[scoreKey]++;
                currentState.log[`p${player}`] = `${logName} でアタック！ +${scoreKey}点`;
            } else {
                currentState.log[`p${player}`] = `${logName} は両者クローズのため無効`;
            }
        }

        updateUI();
        checkGameEnd();
    }

    // --- 履歴・Undoロジック ---
    function pushToHistory() {
        // ディープコピーで現在の状態をスタックに保存
        const snapshot = JSON.parse(JSON.stringify(currentState));
        historyStack.push(snapshot);
        if (historyStack.length > 20) historyStack.shift(); // 上限20手
    }

    btnUndo.addEventListener('click', () => {
        if (historyStack.length === 0) return;
        currentState = historyStack.pop();
        updateUI();
    });

    btnReset.addEventListener('click', () => {
        if (confirm('スコアをすべてリセットして新しいゲームを始めますか？')) {
            init();
        }
    });

    // --- UI同期 ---
    function updateUI() {
        // プレイヤー1の行を更新
        updateSideUI(1, p1RowsContainer, currentState.board.p1);
        // プレイヤー2の行を更新
        updateSideUI(2, p2RowsContainer, currentState.board.p2);

        // 総得点計算
        const p1Total = calculateTotalScore(currentState.scores.p1);
        const p2Total = calculateTotalScore(currentState.scores.p2);

        p1TotalDisplay.textContent = `${p1Total}点`;
        p2TotalDisplay.textContent = `${p2Total}点`;

        // ログ更新
        p1LogBox.textContent = currentState.log.p1;
        p2LogBox.textContent = currentState.log.p2;

        // Undoボタンのアクティブ状態
        btnUndo.disabled = (historyStack.length === 0);
    }

    function updateSideUI(player, container, boardState) {
        TARGET_AREAS.forEach(area => {
            const row = container.querySelector(`.counter-row[data-area="${area}"]`);
            const marksCount = boardState[area];
            
            // マーク表示の書き換え
            const statusBox = row.querySelector('.mark-status-box');
            statusBox.textContent = MARK_SYMBOLS[marksCount];

            // クローズ状態クラスのトグル
            row.classList.toggle('closed', marksCount === 3);
        });
    }

    function calculateTotalScore(scoreObj) {
        let total = 0;
        for (const [value, count] of Object.entries(scoreObj)) {
            total += parseInt(value) * count;
        }
        return total;
    }

    // --- ゲーム終了判定 ---
    function checkGameEnd() {
        // ブル以外の6つの奇数エリア
        const ODD_AREAS = TARGET_AREAS.filter(a => a !== 'bull');
        
        const isStalemate = ODD_AREAS.every(area => {
            return currentState.board.p1[area] === 3 && currentState.board.p2[area] === 3;
        });

        if (isStalemate) {
            const p1Total = calculateTotalScore(currentState.scores.p1);
            const p2Total = calculateTotalScore(currentState.scores.p2);

            if (p1Total > p2Total) {
                winnerAnnouncement.textContent = 'PLAYER 1 の勝利！';
            } else if (p2Total > p1Total) {
                winnerAnnouncement.textContent = 'PLAYER 2 の勝利！';
            } else {
                winnerAnnouncement.textContent = '引き分け！';
            }

            finalResults.textContent = `最終スコア: P1 ${p1Total}点 vs P2 ${p2Total}点`;
            gameOverModal.classList.remove('hidden');
        }
    }

    btnModalClose.addEventListener('click', () => {
        gameOverModal.classList.add('hidden');
    });

    // 起動
    init();
});
