document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素获取 (无改动) ---
    const mainTitle = document.getElementById('main-title');
    const pairSlider = document.getElementById('pair-slider');
    const sliderValue = document.getElementById('slider-value');
    const importBtn = document.getElementById('import-btn');
    const fileInput = document.getElementById('file-input');
    const startBtn = document.getElementById('start-btn');
    const timerDisplay = document.getElementById('timer-display');
    const gameBoard = document.getElementById('game-board');
    const winModal = document.getElementById('win-modal');
    const winTime = document.getElementById('win-time');
    const continueBtn = document.getElementById('continue-btn');

    // --- 全局状态变量 (无改动) ---
    let masterWordList = [];
    let currentGameWords = [];
    let firstSelection = null;
    let secondSelection = null;
    let lockBoard = true;
    let timerInterval = null;
    let seconds = 0;
    let currentWordIndex = 0;

    // --- 初始化 (无改动) ---
    function loadFromLocalStorage() {
        const savedTitle = localStorage.getItem('wordGameTitle');
        if (savedTitle) { mainTitle.textContent = savedTitle; }
        const savedWordList = localStorage.getItem('wordGameList');
        if (savedWordList) {
            masterWordList = JSON.parse(savedWordList);
            console.log('从本地存储加载了词表。');
        }
        const savedIndex = localStorage.getItem('wordGameIndex');
        if(savedIndex) { currentWordIndex = parseInt(savedIndex, 10); }
        updateSliderAndBoard();
    }

    // --- 事件监听器 (无改动) ---
    mainTitle.addEventListener('blur', () => { localStorage.setItem('wordGameTitle', mainTitle.textContent); });
    pairSlider.addEventListener('input', () => { updateSliderAndBoard(); });
    importBtn.addEventListener('click', () => { fileInput.click(); });
    fileInput.addEventListener('change', handleFile);
    startBtn.addEventListener('click', handleStartButtonClick);
    gameBoard.addEventListener('click', handleCardClick);
    continueBtn.addEventListener('click', () => {
        winModal.style.display = 'none';
        continueChallenge();
    });

    // --- 核心功能函数 ---
    function updateSliderAndBoard() {
        sliderValue.textContent = pairSlider.value;
        if (masterWordList.length > 0 && lockBoard) {
            setupGameBoard();
        }
    }

    function handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            masterWordList = json.filter(row => row && row[0] && row[1]).map(row => [String(row[0]).trim(), String(row[1]).trim()]);
            if (masterWordList.length === 0) {
                alert('导入失败！请确保Excel第一列是单词，第二列是答案，且内容不为空。');
                return;
            }
            alert(`成功导入 ${masterWordList.length} 对单词！`);
            localStorage.setItem('wordGameList', JSON.stringify(masterWordList));
            resetGame();
        };
        reader.readAsArrayBuffer(file);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // ★★★ 【重大修改】设置游戏面板，使用最简单的单层卡片结构 ★★★
    function setupGameBoard() {
        const pairCount = parseInt(pairSlider.value, 10);
        let availableWords = masterWordList.slice(currentWordIndex);
        if (availableWords.length === 0 && masterWordList.length > 0) {
            alert('所有单词已挑战完毕，将从头开始新一轮！');
            currentWordIndex = 0;
            availableWords = masterWordList.slice(currentWordIndex);
        }
        currentGameWords = availableWords.slice(0, pairCount);
        if (currentGameWords.length === 0 && masterWordList.length > 0) {
            alert('当前轮次没有足够的单词，请减少单词对数量或重新开始。');
        }
        let cardsData = [];
        currentGameWords.forEach((pair, index) => {
            cardsData.push({ text: pair[0], pairId: index });
            cardsData.push({ text: pair[1], pairId: index });
        });
        shuffleArray(cardsData);

        gameBoard.innerHTML = '';
        const colors = ['pink', 'green', 'purple', 'orange', 'brown', 'blue'];
        cardsData.forEach(data => {
            // 创建最简单的卡片结构
            const card = document.createElement('div');
            card.classList.add('card');
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            card.classList.add(`color-${randomColor}`);
            card.dataset.pairId = data.pairId;
            card.textContent = data.text;
            gameBoard.appendChild(card);
        });
    }

    function handleStartButtonClick() {
        if (masterWordList.length === 0) {
            alert('请先导入单词表！');
            return;
        }
        if (startBtn.textContent.includes('重新开始')) {
            resetGame();
        } else {
            startGame();
        }
    }

    // ★★★ 【简化】开始游戏逻辑 ★★★
    function startGame() {
        lockBoard = false;
        gameBoard.classList.remove('locked');
        startBtn.textContent = '重新开始（重置词汇）';
        startBtn.classList.add('restarting');
        startTimer();
    }

    function resetGame() {
        stopTimer();
        seconds = 0;
        updateTimerDisplay();
        currentWordIndex = 0;
        localStorage.setItem('wordGameIndex', currentWordIndex);
        shuffleArray(masterWordList);
        setupGameBoard();
        lockBoard = true;
        gameBoard.classList.add('locked');
        startBtn.textContent = '【开始游戏】';
        startBtn.classList.remove('restarting');
    }

    // ★★★ 【简化】卡片点击逻辑，适配简单结构 ★★★
    function handleCardClick(e) {
        if (lockBoard) return;
        const clickedCard = e.target.closest('.card');
        if (!clickedCard || clickedCard.classList.contains('matched') || clickedCard === firstSelection) return;

        clickedCard.classList.add('selected');

        if (!firstSelection) {
            firstSelection = clickedCard;
        } else {
            secondSelection = clickedCard;
            lockBoard = true;
            checkForMatch();
        }
    }

    function checkForMatch() {
        const isMatch = firstSelection.dataset.pairId === secondSelection.dataset.pairId;
        isMatch ? disableCards() : unselectCards(); // 重命名函数
    }

    function disableCards() {
        firstSelection.classList.add('matched');
        secondSelection.classList.add('matched');
        setTimeout(() => {
            // 这里可以保留，因为matched动画会处理隐藏
            resetSelections();
            checkForWin();
        }, 800);
    }

    // ★★★ 【重命名并简化】不再是“翻转”，而是“取消选择” ★★★
    function unselectCards() {
        firstSelection.classList.add('mismatched');
        secondSelection.classList.add('mismatched');

        setTimeout(() => {
            firstSelection.classList.remove('selected', 'mismatched');
            secondSelection.classList.remove('selected', 'mismatched');
            resetSelections();
        }, 800); // 给动画留足时间
    }

    function resetSelections() {
        [firstSelection, secondSelection] = [null, null];
        lockBoard = false;
    }

    function checkForWin() {
        if (currentGameWords.length > 0 && document.querySelectorAll('.card.matched').length === currentGameWords.length * 2) {
            stopTimer();
            setTimeout(showWinModal, 500);
        }
    }

    function showWinModal() {
        winTime.textContent = `耗时：${seconds} 秒`;
        winModal.style.display = 'flex';
    }

    function continueChallenge() {
        stopTimer();
        seconds = 0;
        updateTimerDisplay();
        currentWordIndex += parseInt(pairSlider.value, 10);
        localStorage.setItem('wordGameIndex', currentWordIndex);
        setupGameBoard();
        lockBoard = true;
        gameBoard.classList.add('locked');
        startBtn.textContent = '【开始游戏】';
        startBtn.classList.remove('restarting');
    }

    // --- 计时器函数 (无改动) ---
    function startTimer() {
        stopTimer();
        seconds = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            seconds++;
            updateTimerDisplay();
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
    function updateTimerDisplay() { timerDisplay.textContent = `耗时：${seconds} 秒`; }

    loadFromLocalStorage();
});