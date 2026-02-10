const WORD_LEN = 5;
const MODES = {
    OFFICIAL: 'official',
    EXTREME: 'extreme',
    ABSURDLE: 'absurdle'
};

let currentMode = MODES.OFFICIAL;
let validWords = new Set();
let possibleAnswers = [];
let absurdlePool = [];

let secretWord = "";
let currentGuess = "";
let currentRow = 0;
let gameOver = false;
let maxRows = 6;

const boardEl = document.getElementById("game-board");
const keyboardEl = document.getElementById("keyboard");
const messageEl = document.getElementById("message");
const modeBtn = document.getElementById("modeBtn");
const wordInfoEl = document.getElementById("word-left-info");

// Mock word list fallback
const MOCK_ANSWERS = ["APPLE", "BEACH", "BRAIN", "BREAD", "CHAIR", "CLOCK", "CLOUD", "DANCE", "EARTH", "FIELD", "FRUIT", "GLASS", "HEART", "HOUSE", "JUICE", "LIGHT", "MUSIC", "NIGHT", "OCEAN", "PIANO", "PLANT", "RADIO", "RIVER", "SHIRT", "SMILE", "SNAKE", "SPACE", "TABLE", "TIGER", "WATCH", "WATER", "WORLD"];
const MOCK_VALID = ["ABUSE", "ADULT", "AGENT", "ANGER", "APPLE", "AWARD", "BASIS", "BEACH", "BIRTH", "BLOCK", "BLOOD", "BOARD", "BRAIN", "BREAD", "BREAK", "BROWN", "BUYER", "CAUSE", "CHAIN", "CHAIR", "CHEST", "CHIEF", "CHILD", "CHINA", "CLAIM", "CLASS", "CLOCK", "COACH", "COAST", "COURT", "COVER", "CREAM", "CRIME", "CROSS", "CROWD", "CROWN", "CYCLE", "DANCE", "DEATH", "DEPTH", "DIRTY", "DRESS", "DRINK", "DRIVE", "DUSTY", "EARTH", "EMPTY", "ENEMY", "ENTRY", "ERROR", "EVENT", "FAITH", "FAULT", "FIELD", "FIGHT", "FINAL", "FLOOR", "FOCUS", "FORCE", "FRAME", "FRESH", "FRONT", "FRUIT", "GLASS", "GRAPE", "GREEN", "GROUP", "GUIDE", "HEART", "HORSE", "HOTEL", "HOUSE", "IMAGE", "INDEX", "INPUT", "ISSUE", "JAPAN", "JOINT", "JUDGE", "KNIFE", "LAYER", "LEVEL", "LIGHT", "LIMIT", "LUNCH", "MAJOR", "MARCH", "MATCH", "METAL", "MODEL", "MONEY", "MONTH", "MOTOR", "MOUTH", "MUSIC", "NIGHT", "NOISE", "NORTH", "NOVEL", "NURSE", "OFFER", "ORDER", "OTHER", "OWNER", "PANEL", "PAPER", "PARTY", "PEACE", "PHASE", "PHONE", "PHOTO", "PIECE", "PILOT", "PITCH", "PLACE", "PLANE", "PLANT", "PLATE", "POINT", "POUND", "POWER", "PRESS", "PRICE", "PRIDE", "PRIZE", "PROOF", "QUEEN", "RADIO", "RANGE", "RATIO", "REPLY", "RIGHT", "RIVER", "ROUND", "ROUTE", "SCALE", "SCENE", "SCOPE", "SCORE", "SENSE", "SHAPE", "SHARE", "SHEEP", "SHEET", "SHIFT", "SHIRT", "SHOCK", "SHOOT", "SLEEP", "SMALL", "SMILE", "SMOKE", "SOUND", "SOUTH", "SPACE", "SPEED", "SPEND", "SPORT", "STAFF", "STAGE", "STAMP", "START", "STATE", "STEAM", "STEEL", "STICK", "STILL", "STOCK", "STONE", "STORE", "STUDY", "STUFF", "STYLE", "SUGAR", "TABLE", "TASTE", "THEME", "THING", "TITLE", "TOTAL", "TOUCH", "TOWER", "TRACK", "TRADE", "TRAIN", "TREND", "TRIAL", "TRUST", "TRUTH", "VALUE", "VIDEO", "VISIT", "VOICE", "WASTE", "WATCH", "WATER", "WHILE", "WHITE", "WHOLE", "WOMAN", "WORLD", "YOUTH"];

async function init() {
    await loadWords();
    setupKeyboard();
    newGame();

    modeBtn.addEventListener("click", toggleMode);
    document.getElementById("statsBtn").addEventListener("click", openStats);
    document.getElementById("closeStatsBtn").addEventListener("click", closeStats);
    document.getElementById("newGameBtn").addEventListener("click", () => {
        closeStats();
        newGame();
    });
}

async function loadWords() {
    try {
        const [resValid, resAnswers] = await Promise.all([
            fetch("validwords.txt"),
            fetch("possibleanswers.txt")
        ]);

        const clean = s => s.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(w => w.length === 5);

        if (resValid.ok && resAnswers.ok) {
            const vText = await resValid.text();
            const aText = await resAnswers.text();
            possibleAnswers = clean(aText);
            const vList = clean(vText);
            vList.forEach(w => validWords.add(w));
            possibleAnswers.forEach(w => validWords.add(w));
        } else {
            throw new Error("Files missing");
        }
    } catch (e) {
        console.warn("Using mock list");
        possibleAnswers = MOCK_ANSWERS;
        MOCK_VALID.forEach(w => validWords.add(w));
    }
}

function setupBoard() {
    boardEl.innerHTML = "";
    maxRows = currentMode === MODES.ABSURDLE ? 10 : 6;
    boardEl.style.gridTemplateRows = `repeat(${maxRows}, 1fr)`;

    for (let i = 0; i < maxRows; i++) {
        const row = document.createElement("div");
        row.className = "row";
        for (let j = 0; j < WORD_LEN; j++) {
            const tile = document.createElement("div");
            tile.className = "tile";
            row.appendChild(tile);
        }
        boardEl.appendChild(row);
    }
}

function setupKeyboard() {
    const layout = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
    ];

    keyboardEl.innerHTML = "";
    layout.forEach(rowKeys => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "keyboard-row";
        rowKeys.forEach(k => {
            const btn = document.createElement("button");
            btn.textContent = k === "BACK" ? "⌫" : k;
            btn.className = "key" + (k.length > 1 ? " wide" : "");
            btn.dataset.key = k;
            btn.onclick = () => handleKey(k);
            rowDiv.appendChild(btn);
        });
        keyboardEl.appendChild(rowDiv);
    });

    window.onkeydown = (e) => {
        if (gameOver) return;
        const key = e.key.toUpperCase();
        if (key === "ENTER") handleKey("ENTER");
        else if (key === "BACKSPACE") handleKey("BACK");
        else if (/^[A-Z]$/.test(key)) handleKey(key);
    };
}

function handleKey(k) {
    if (gameOver) return;
    if (k === "ENTER") {
        if (currentGuess.length === WORD_LEN) {
            if (validWords.has(currentGuess)) {
                submitGuess();
            } else {
                showMessage("Not in word list");
            }
        } else {
            showMessage("Too short");
        }
    } else if (k === "BACK") {
        currentGuess = currentGuess.slice(0, -1);
        updateRow();
    } else if (currentGuess.length < WORD_LEN && /^[A-Z]$/.test(k)) {
        currentGuess += k;
        updateRow();
    }
}

function updateRow() {
    const row = boardEl.children[currentRow];
    if (!row) return;
    const tiles = row.children;
    for (let i = 0; i < WORD_LEN; i++) {
        tiles[i].textContent = currentGuess[i] || "";
        tiles[i].classList.toggle("filled", !!currentGuess[i]);
    }
}

function submitGuess() {
    let resultPattern;
    const guessSnapshot = currentGuess;

    if (currentMode === MODES.ABSURDLE) {
        resultPattern = runAbsurdleLogic(guessSnapshot);
    } else {
        resultPattern = getPattern(guessSnapshot, secretWord);
    }

    revealRow(resultPattern, guessSnapshot);
}

function getPattern(guess, target) {
    const pattern = Array(WORD_LEN).fill("absent");
    const targetArr = target.split("");
    const guessArr = guess.split("");

    for (let i = 0; i < WORD_LEN; i++) {
        if (guessArr[i] === targetArr[i]) {
            pattern[i] = "correct";
            targetArr[i] = null;
            guessArr[i] = null;
        }
    }
    for (let i = 0; i < WORD_LEN; i++) {
        if (guessArr[i] && targetArr.includes(guessArr[i])) {
            pattern[i] = "present";
            targetArr[targetArr.indexOf(guessArr[i])] = null;
        }
    }
    return pattern;
}

function runAbsurdleLogic(guess) {
    const buckets = {};
    absurdlePool.forEach(word => {
        const p = getPattern(guess, word).join(",");
        if (!buckets[p]) buckets[p] = [];
        buckets[p].push(word);
    });

    let bestPatternStr = "";
    let maxCount = -1;
    for (const p in buckets) {
        if (buckets[p].length > maxCount) {
            maxCount = buckets[p].length;
            bestPatternStr = p;
        }
    }

    absurdlePool = buckets[bestPatternStr];
    updateWordInfo();
    return bestPatternStr.split(",");
}

function revealRow(pattern, guessUsed) {
    const row = boardEl.children[currentRow];
    if (!row) return;
    const tiles = row.children;

    pattern.forEach((state, i) => {
        setTimeout(() => {
            tiles[i].classList.add(state);
            updateKeyboardUI(guessUsed[i], state);
        }, i * 200);
    });

    setTimeout(() => {
        if (pattern.every(s => s === "correct")) {
            endGame(true);
        } else {
            currentRow++;
            currentGuess = "";
            if (currentRow >= maxRows) {
                endGame(false);
            }
        }
    }, 1200);
}

function updateKeyboardUI(letter, state) {
    const btn = document.querySelector(`.key[data-key="${letter}"]`);
    if (!btn) return;
    const states = ["absent", "present", "correct"];
    const currentIdx = states.indexOf(btn.dataset.state || "");
    const newIdx = states.indexOf(state);
    if (newIdx > currentIdx) {
        btn.classList.remove("absent", "present", "correct");
        btn.classList.add(state);
        btn.dataset.state = state;
    }
}

function toggleMode() {
    if (currentMode === MODES.OFFICIAL) {
        currentMode = MODES.EXTREME;
        modeBtn.textContent = "🔥 EXTREME";
    } else if (currentMode === MODES.EXTREME) {
        currentMode = MODES.ABSURDLE;
        modeBtn.textContent = "🌀 ABSURDLE";
    } else {
        currentMode = MODES.OFFICIAL;
        modeBtn.textContent = "📜 OFFICIAL";
    }
    newGame();
}

function newGame() {
    currentRow = 0;
    currentGuess = "";
    gameOver = false;
    setupBoard();

    document.querySelectorAll(".key").forEach(k => {
        k.classList.remove("absent", "present", "correct");
        delete k.dataset.state;
    });

    if (currentMode === MODES.OFFICIAL) {
        secretWord = possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)] || "APPLE";
        wordInfoEl.textContent = "";
    } else if (currentMode === MODES.EXTREME) {
        const all = Array.from(validWords);
        secretWord = all[Math.floor(Math.random() * all.length)] || "HOUSE";
        wordInfoEl.textContent = "Pool: All Valid Words";
    } else {
        absurdlePool = Array.from(validWords);
        updateWordInfo();
    }
    showMessage(`Mode: ${currentMode.toUpperCase()}`, 1500);
}

function updateWordInfo() {
    if (currentMode === MODES.ABSURDLE) {
        wordInfoEl.textContent = `Words left: ${absurdlePool.length}`;
    }
}

function endGame(won) {
    gameOver = true;
    const title = won ? "Impressive!" : "Game Over";
    let body = "";
    if (currentMode === MODES.ABSURDLE) {
        body = won ? `You trapped the game into: ${absurdlePool[0]}` : `The game successfully dodged you.`;
    } else {
        body = won ? `You got it in ${currentRow + 1} guesses!` : `The word was ${secretWord}`;
    }

    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").textContent = body;
    openStats();
}

function showMessage(msg, dur = 2000) {
    messageEl.textContent = msg;
    if (dur > 0) setTimeout(() => { if(messageEl.textContent === msg) messageEl.textContent = ""; }, dur);
}

function openStats() { document.getElementById("statsModal").classList.add("show"); }
function closeStats() { document.getElementById("statsModal").classList.remove("show"); }

init();
