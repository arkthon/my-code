document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素获取 ---
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

    // --- 全局状态变量 ---
    let masterWordList = []; // 存储从Excel导入的所有单词对
    let currentGameWords = []; // 当前游戏使用的单词对
    let firstSelection = null; // 第一次点击的卡片
    let secondSelection = null; // 第二次点击的卡片
    let lockBoard = true; // 锁定面板，防止在动画或未开始时点击
    let timerInterval = null; // 计时器ID
    let seconds = 0; // 耗时秒数
    let currentWordIndex = 0; // 用于“继续挑战”，记录当前用到词表的哪个位置

    // --- 初始化 ---
    // 从 localStorage 加载数据
    function loadFromLocalStorage() {
        const savedTitle = localStorage.getItem('wordGameTitle');
        if (savedTitle) {
            mainTitle.textContent = savedTitle;
        }

        const savedWordList = localStorage.getItem('wordGameList');
        if (savedWordList) {
            masterWordList = JSON.parse(savedWordList);
            console.log('从本地存储加载了词表。');
        }
        
        const savedIndex = localStorage.getItem('wordGameIndex');
        if(savedIndex) {
            currentWordIndex = parseInt(savedIndex, 10);
        }

        updateSliderAndBoard();
    }

    // --- 事件监听器 ---

    // 标题修改后保存
    mainTitle.addEventListener('blur', () => {
        localStorage.setItem('wordGameTitle', mainTitle.textContent);
    });

    // 滑块滑动
    pairSlider.addEventListener('input', () => {
        updateSliderAndBoard();
    });

    // 导入按钮点击
    importBtn.addEventListener('click', () => {
        fileInput.click(); // 触发隐藏的文件输入框
    });

    // 文件选择后处理
    fileInput.addEventListener('change', handleFile);

    // 开始/重置按钮点击
    startBtn.addEventListener('click', handleStartButtonClick);

    // 点击游戏面板（事件委托）
    gameBoard.addEventListener('click', handleCardClick);

    // 继续挑战按钮
    continueBtn.addEventListener('click', () => {
        winModal.style.display = 'none';
        continueChallenge();
    });

    // --- 核心功能函数 ---

    // 更新滑块显示值并重新生成面板
    function updateSliderAndBoard() {
        sliderValue.textContent = pairSlider.value;
        // 如果有单词列表，并且游戏未开始，则实时更新面板预览
        if (masterWordList.length > 0 && lockBoard) {
            setupGameBoard();
        }
    }

    // 处理导入的Excel文件
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
            
            // 过滤掉空行，并确保是成对的数据
            masterWordList = json.filter(row => row && row[0] && row[1]).map(row => [String(row[0]).trim(), String(row[1]).trim()]);

            if (masterWordList.length === 0) {
                alert('导入失败！请确保Excel第一列是单词，第二列是答案，且内容不为空。');
                return;
            }

            alert(`成功导入 ${masterWordList.length} 对单词！`);
            localStorage.setItem('wordGameList', JSON.stringify(masterWordList));
            resetGame(); // 导入新词表后，重置游戏
        };
        reader.readAsArrayBuffer(file);
    }
    
    // Fisher-Yates 洗牌算法
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 设置游戏面板
    function setupGameBoard() {
        const pairCount = parseInt(pairSlider.value, 10);
        
        // 确定从主列表拿哪一部分单词
        let availableWords = masterWordList.slice(currentWordIndex);
        if (availableWords.length === 0 && masterWordList.length > 0) {
            // 如果到底了，则从头开始
             alert('所有单词已挑战完毕，将从头开始新一轮！');
            currentWordIndex = 0;
            availableWords = masterWordList.slice(currentWordIndex);
        }

        currentGameWords = availableWords.slice(0, pairCount);

        if (currentGameWords.length === 0 && masterWordList.length > 0) {
            alert('当前轮次没有足够的单词，请减少单词对数量或重新开始。');
        }

        // 将单词和答案拆分并组合成一个列表
        let cardsData = [];
        currentGameWords.forEach((pair, index) => {
            cardsData.push({ text: pair[0], pairId: index });
            cardsData.push({ text: pair[1], pairId: index });
        });

        shuffleArray(cardsData); // 打乱卡片顺序

        // 生成卡片HTML
        gameBoard.innerHTML = '';
        const colors = ['pink', 'green', 'purple', 'orange', 'brown', 'blue'];
        cardsData.forEach(data => {
            const card = document.createElement('div');
            card.classList.add('card');
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            card.classList.add(`color-${randomColor}`);
            card.dataset.pairId = data.pairId;
            card.textContent = data.text;
            gameBoard.appendChild(card);
        });
    }

    // 处理开始/重置按钮的逻辑
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

    // 开始游戏
    function startGame() {
        lockBoard = false;
        gameBoard.classList.remove('locked');
        startBtn.textContent = '重新开始（重置词汇）';
        startBtn.classList.add('restarting');
        startTimer();
    }
    
    // 重置游戏（重置词汇）
    function resetGame() {
        stopTimer();
        seconds = 0;
        updateTimerDisplay();
        currentWordIndex = 0;
        localStorage.setItem('wordGameIndex', currentWordIndex);
        shuffleArray(masterWordList); // 重新打乱整个词库
        setupGameBoard();
        lockBoard = true;
        gameBoard.classList.add('locked');
        startBtn.textContent = '【开始游戏】';
        startBtn.classList.remove('restarting');
    }

    // 处理卡片点击
    function handleCardClick(e) {
        if (lockBoard) return;
        const clickedCard = e.target;

        // 确保点击的是卡片本身，而不是面板背景
        if (!clickedCard.classList.contains('card')) return;
        // 防止点击已匹配或同一张卡片
        if (clickedCard.classList.contains('matched') || clickedCard === firstSelection) return;

        clickedCard.classList.add('selected');

        if (!firstSelection) {
            firstSelection = clickedCard;
        } else {
            secondSelection = clickedCard;
            lockBoard = true; // 锁定面板，检查是否匹配
            checkForMatch();
        }
    }

    // 检查是否匹配
    function checkForMatch() {
        const isMatch = firstSelection.dataset.pairId === secondSelection.dataset.pairId;
        isMatch ? disableCards() : unflipCards();
    }
    
    // 匹配成功
    function disableCards() {
        firstSelection.classList.add('matched');
        secondSelection.classList.add('matched');
        
        // 华丽地消除动画
        setTimeout(() => {
            firstSelection.style.visibility = 'hidden';
            secondSelection.style.visibility = 'hidden';
            resetSelections();
            checkForWin();
        }, 800);
    }
    
    // 匹配失败
    function unflipCards() {
        firstSelection.classList.add('mismatched');
        secondSelection.classList.add('mismatched');

        // 红色动效结束后，恢复原样
        setTimeout(() => {
            firstSelection.classList.remove('selected', 'mismatched');
            secondSelection.classList.remove('selected', 'mismatched');
            resetSelections();
        }, 500);
    }
    
    // 重置选择
    function resetSelections() {
        [firstSelection, secondSelection] = [null, null];
        lockBoard = false;
    }

    // 检查是否胜利
    function checkForWin() {
        const allCards = document.querySelectorAll('.card');
        const matchedCards = document.querySelectorAll('.card.matched');
        if (allCards.length > 0 && allCards.length === matchedCards.length) {
            stopTimer();
            showWinModal();
        }
    }

    // 显示胜利模态框
    function showWinModal() {
        winTime.textContent = `耗时：${seconds} 秒`;
        winModal.style.display = 'flex';
    }

    // 继续挑战
    function continueChallenge() {
        stopTimer();
        seconds = 0;
        updateTimerDisplay();
        
        // 更新索引到下一批单词
        currentWordIndex += parseInt(pairSlider.value, 10);
        localStorage.setItem('wordGameIndex', currentWordIndex);
        
        setupGameBoard();
        lockBoard = true;
        gameBoard.classList.add('locked');
        startBtn.textContent = '【开始游戏】';
        startBtn.classList.remove('restarting');
    }

    // --- 计时器函数 ---
    function startTimer() {
        stopTimer(); // 先清除可能存在的旧计时器
        seconds = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            seconds++;
            updateTimerDisplay();
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function updateTimerDisplay() {
        timerDisplay.textContent = `耗时：${seconds} 秒`;
    }

    // --- 页面加载时执行初始化 ---
    loadFromLocalStorage();
});