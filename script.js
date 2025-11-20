const BOARD_ROWS = 6;
const WORD_LEN = 5;

let validWords = new Set(); // All guessable words
let possibleAnswers = [];   // Words used for Official Mode solutions
let allGuessableWords = []; // Array of all words, used for Special Mode solutions

let secretWord = "";
let currentRow = 0;
let currentGuess = "";
let gameOver = false;

// --- Game State & Mode ---
const LS_STATS = "wordle_stats_v3"; // Updated version for new features
let currentMode = "official"; // 'official' or 'special'

// --- Stats Management ---

function defaultStats() {
    return {
        played: 0,
        wins: 0,
        currentStreak: 0,
        maxStreak: 0,
        dist: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "X": 0 }
    };
}
function getStats() { return JSON.parse(localStorage.getItem(LS_STATS)) || defaultStats(); }
function setStats(s) { localStorage.setItem(LS_STATS, JSON.stringify(s)); }

// --- Initialization & Word Loading ---

async function loadWords() {
    try {
        const valid = await fetch("validwords.txt").then(r => r.text());
        const answers = await fetch("possibleanswers.txt").then(r => r.text());
        const clean = s => s.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean);

        // Populate the set of all valid words (guesses)
        clean(valid).forEach(w => validWords.add(w));

        // Populate the list of official answers
        possibleAnswers = clean(answers);
        
        // Ensure official answers are also in the valid guesses set
        possibleAnswers.forEach(w => validWords.add(w));

        // Create the array used for Special Mode solutions
        allGuessableWords = Array.from(validWords);

    } catch (error) {
        console.error("Failed to load word lists:", error);
        setMessage("Error loading word lists.");
    }
}

function setupBoard() {
    const board = document.getElementById("game-board");
    board.innerHTML = "";
    for (let i = 0; i < BOARD_ROWS; i++) {
        const row = document.createElement("div");
        row.className = "row";
        for (let j = 0; j < WORD_LEN; j++) {
            const tile = document.createElement("div");
            tile.className = "tile";
            row.appendChild(tile);
        }
        board.appendChild(row);
    }
}

function setupKeyboard() {
    const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    const keyboard = document.getElementById("keyboard");
    keyboard.innerHTML = "";
    
    // Helper function to add key elements
    function addKey(k, wide = false, container) {
        const b = document.createElement("button");
        b.textContent = (k === "back" ? "⌫" : k.toUpperCase());
        b.className = "key" + (wide ? " wide" : "");
        b.dataset.key = k;
        b.addEventListener("click", () => handleKey(k));
        container.appendChild(b);
    }

    // Creating keyboard rows with ENTER and BACKSPACE correctly positioned
    rows.forEach((row, index) => {
        const rowDiv = document.createElement("div");
        rowDiv.className = `keyboard-row row-${index}`;
        
        if (index === 2) { // Add ENTER before the last row's letters
            addKey("enter", true, rowDiv);
        }
        row.split("").forEach(k => addKey(k, false, rowDiv));
        if (index === 2) { // Add BACKSPACE after the last row's letters
            addKey("back", true, rowDiv);
        }
        keyboard.appendChild(rowDiv);
    });


    document.addEventListener("keydown", e => {
        if (gameOver) return;
        const key = e.key.toLowerCase();
        if (key === "enter") handleKey("enter");
        else if (key === "backspace") handleKey("back");
        else if (/^[a-z]$/.test(key)) handleKey(key);
    });
}

// --- Mode Switching Logic ---

function toggleMode() {
    currentMode = currentMode === 'official' ? 'special' : 'official';
    const modeBtn = document.getElementById("modeBtn");
    if (modeBtn) {
        modeBtn.textContent = currentMode === 'official' ? '📜 OFFICIAL' : '✨ SPECIAL';
    }
    newGame();
    setMessage(`Mode switched to ${currentMode.toUpperCase()}. New game started!`);
}

function setMessage(msg, duration = 2000) {
    const messageElement = document.getElementById("message");
    messageElement.textContent = msg;
    if (duration > 0) {
        setTimeout(() => {
            messageElement.textContent = "";
        }, duration);
    }
}

function updateRow() {
    const rowEl = document.getElementsByClassName("row")[currentRow];
    if (!rowEl) return;
    const tiles = rowEl.getElementsByClassName("tile");
    for (let i = 0; i < WORD_LEN; i++) {
        const ch = currentGuess[i] || "";
        tiles[i].textContent = ch.toUpperCase();
        tiles[i].classList.toggle("filled", !!ch);
    }
}

function handleKey(k) {
    if (gameOver) return;
    if (k === "enter") {
        if (currentGuess.length !== WORD_LEN) { setMessage("Need 5 letters 🤏"); return; }
        // The guess must be in the full list of valid words regardless of mode
        if (!validWords.has(currentGuess)) { setMessage("Not in word list ❌"); return; }
        submitGuess();
        return;
    }
    if (k === "back") currentGuess = currentGuess.slice(0, -1);
    else if (/^[a-z]$/.test(k) && currentGuess.length < WORD_LEN) currentGuess += k;
    updateRow();
}

// --- Core Game Logic (No changes needed here) ---

function evaluateGuess(guess, answer) {
    const res = Array(WORD_LEN).fill("absent");
    const counts = {};
    for (const ch of answer) counts[ch] = (counts[ch] || 0) + 1;
    for (let i = 0; i < WORD_LEN; i++) {
        if (guess[i] === answer[i]) { res[i] = "correct"; counts[guess[i]]--; }
    }
    for (let i = 0; i < WORD_LEN; i++) {
        if (res[i] === "correct") continue;
        const ch = guess[i];
        if (counts[ch] > 0) { res[i] = "present"; counts[ch]--; }
    }
    return res;
}

function colorKeyboard(guess, res) {
    for (let i = 0; i < WORD_LEN; i++) {
        const ch = guess[i];
        const btn = document.querySelector(`.key[data-key="${ch}"]`);
        if (!btn) continue;
        
        // State ranking: correct (2) > present (1) > absent (0)
        const currentState = btn.classList.contains("correct") ? 2 :
                             btn.classList.contains("present") ? 1 : 0;
        const newState = (res[i] === "correct") ? 2 :
                         (res[i] === "present") ? 1 : 0;

        // Only upgrade the color if the new state is better than the current one
        if (newState > currentState) {
            btn.classList.remove("present", "absent", "correct");
            btn.classList.add(res[i]);
        } else if (newState === 0 && currentState === 0) {
            // If it's absent and the current state is also absent (or nothing), set it to absent
            btn.classList.add("absent");
        }
    }
}

function revealRow(rowEl, res) {
    const tiles = rowEl.querySelectorAll(".tile");
    tiles.forEach((t, i) => {
        setTimeout(() => {
            t.classList.add(res[i]);
        }, i * 300);
    });
}

function submitGuess() {
    const guess = currentGuess;
    const rowEl = document.getElementsByClassName("row")[currentRow];
    const res = evaluateGuess(guess, secretWord);
    revealRow(rowEl, res);
    colorKeyboard(guess, res);
    if (guess === secretWord) {
        setTimeout(() => endGame(true, currentRow + 1), 1800);
        gameOver = true;
    } else {
        currentRow++;
        currentGuess = "";
        if (currentRow >= BOARD_ROWS) {
            setTimeout(() => endGame(false, "X"), 1200);
            gameOver = true;
            setMessage(`Word was ${secretWord.toUpperCase()} 😵`, 0); // Keep message until modal opens
        }
    }
}

function endGame(won, bucket) {
    const stats = getStats();
    stats.played++;
    if (won) {
        stats.wins++;
        stats.currentStreak++;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        stats.dist[String(bucket)]++;
        setMessage("You win! 🎉", 0);
    } else {
        stats.currentStreak = 0;
        stats.dist["X"]++;
    }
    setStats(stats);
    renderStats(stats);
    openStats();
    // show new game button
    document.getElementById("newGameBtn").style.display = "block";
}

// --- Stats Rendering (Simplified/Cleaned) ---

function renderStats(stats = getStats()) {
    const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    document.getElementById("statPlayed").textContent = stats.played;
    document.getElementById("statWinPct").textContent = winPct;
    document.getElementById("statCurrentStreak").textContent = stats.currentStreak;
    document.getElementById("statMaxStreak").textContent = stats.maxStreak;
    const distEl = document.getElementById("dist");
    distEl.innerHTML = "";
    const labels = ["1", "2", "3", "4", "5", "6", "X"];
    
    // Calculate max score for bar width normalization
    const max = Math.max(1, ...labels.map(l => stats.dist[l] || 0));
    
    labels.forEach(lab => {
        const count = stats.dist[lab] || 0;
        const percentage = count / max * 100;

        const row = document.createElement("div");
        row.className = "dist-row";
        
        const label = document.createElement("div");
        label.className = "dist-label";
        label.textContent = lab;
        
        const wrap = document.createElement("div");
        wrap.className = "dist-bar-wrap";
        
        const bar = document.createElement("div");
        bar.className = "dist-bar";
        bar.style.width = percentage + "%";
        bar.textContent = count;
        
        if (count > 0 && percentage < 5) {
            bar.style.width = '5%'; // Minimum width for visibility
        } else if (count === 0) {
            bar.style.minWidth = "24px"; // Minimum space for zero count
        }
        
        wrap.appendChild(bar);
        row.appendChild(label);
        row.appendChild(wrap);
        distEl.appendChild(row);
    });
}

function openStats() { document.getElementById("statsModal").classList.add("show"); }
function closeStats() { 
    document.getElementById("statsModal").classList.remove("show"); 
    // Clear message only when closing modal if game is over
    if (gameOver) document.getElementById("message").textContent = "";
}

// --- New Game Logic (Mode dependent) ---

function newGame() {
    const answerList = currentMode === 'official' ? possibleAnswers : allGuessableWords;
    
    if (answerList.length === 0) {
        setMessage("Word lists not loaded yet.");
        return;
    }
    
    secretWord = answerList[Math.floor(Math.random() * answerList.length)];
    setupBoard();
    currentRow = 0;
    currentGuess = "";
    gameOver = false;
    setMessage("");
    document.querySelectorAll(".key").forEach(k => k.classList.remove("correct", "present", "absent"));
    
    // hide new game button until next end
    const newGameBtn = document.getElementById("newGameBtn");
    if (newGameBtn) newGameBtn.style.display = "none";
}

window.addEventListener("load", async () => {
    setupBoard();
    setupKeyboard();
    
    // Initialize mode button text
    const modeBtn = document.getElementById("modeBtn");
    if (modeBtn) {
        modeBtn.textContent = currentMode === 'official' ? '📜 OFFICIAL' : '✨ SPECIAL';
        modeBtn.addEventListener("click", toggleMode);
    }
    
    await loadWords();
    newGame();
    
    // Event Listeners
    document.getElementById("statsBtn").addEventListener("click", () => { renderStats(); openStats(); });
    document.getElementById("closeStatsBtn").addEventListener("click", closeStats);
    
    const newGameBtn = document.getElementById("newGameBtn");
    if (newGameBtn) {
        newGameBtn.addEventListener("click", () => {
            closeStats();
            newGame();
        });
    }
});
