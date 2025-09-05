/**********************
 * WORDLE – Offline, saves stats & shows histogram
 * Uses validwords.txt & possibleanswers.txt (one word per line, lowercase)
 **********************/

const BOARD_ROWS = 6;
const WORD_LEN = 5;

let validWords = new Set();
let possibleAnswers = [];
let secretWord = "";

let currentRow = 0;
let currentGuess = "";
let gameOver = false;

// Persistent keys
const LS_STATE = "wordle_state_v1";
const LS_STATS = "wordle_stats_v1";

// Stats structure
// { played:0, wins:0, currentStreak:0, maxStreak:0, dist:{'1':0,'2':0,'3':0,'4':0,'5':0,'6':0,'X':0} }
function defaultStats(){
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    dist: { "1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"X":0 }
  };
}

function getStats(){
  try{ return JSON.parse(localStorage.getItem(LS_STATS)) || defaultStats(); }
  catch{ return defaultStats(); }
}
function setStats(s){ localStorage.setItem(LS_STATS, JSON.stringify(s)); }

// Game state persistence (resume after refresh)
function saveState(){
  const grid = [...document.querySelectorAll(".row")].map(r =>
    [...r.querySelectorAll(".tile")].map(t => ({
      letter: (t.textContent || "").toLowerCase(),
      state: t.dataset.state || ""
    }))
  );
  const state = {
    secretWord, currentRow, currentGuess, gameOver, grid
  };
  localStorage.setItem(LS_STATE, JSON.stringify(state));
}

function loadStateIfAny(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_STATE));
    if(!s || !s.secretWord) return false;
    secretWord = s.secretWord;
    currentRow = s.currentRow || 0;
    currentGuess = s.currentGuess || "";
    gameOver = !!s.gameOver;

    // paint grid
    const rows = document.querySelectorAll(".row");
    s.grid?.forEach((cells, r) => {
      cells.forEach((cell, c) => {
        const t = rows[r]?.children[c];
        if(!t) return;
        t.textContent = (cell.letter || "").toUpperCase();
        if(cell.state){
          t.classList.add(cell.state);
          t.dataset.state = cell.state;
        } else if(cell.letter){
          t.classList.add("filled");
        }
      });
    });
    return true;
  }catch{ return false; }
}

/* ---------- Setup ---------- */
async function loadWords(){
  const valid = await fetch("validwords.txt").then(r=>r.text());
  const answers = await fetch("possibleanswers.txt").then(r=>r.text());

  const clean = s => s.split(/\r?\n/).map(w=>w.trim().toLowerCase()).filter(Boolean);

  clean(valid).forEach(w => validWords.add(w));
  possibleAnswers = clean(answers);
}

function setupBoard(){
  const board = document.getElementById("game-board");
  board.innerHTML = "";
  for(let i=0;i<BOARD_ROWS;i++){
    const row = document.createElement("div");
    row.className = "row";
    for(let j=0;j<WORD_LEN;j++){
      const tile = document.createElement("div");
      tile.className = "tile";
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function setupKeyboard(){
  const rows = [
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm"
  ];
  const keyboard = document.getElementById("keyboard");
  keyboard.innerHTML = "";

  // First row
  rows[0].split("").forEach(k => addKey(k));
  // Row break (CSS grid handles layout; we add small spacer keys for wrap)
  // Second row
  rows[1].split("").forEach(k => addKey(k));
  // Third row with Enter / Back
  addKey("enter", true);
  rows[2].split("").forEach(k => addKey(k));
  addKey("back", true);

  function addKey(k, wide=false){
    const b = document.createElement("button");
    b.textContent = (k==="back"?"⌫":k);
    b.className = "key" + (wide?" wide":"");
    b.dataset.key = k;
    b.addEventListener("click", () => handleKey(k));
    keyboard.appendChild(b);
  }

  document.addEventListener("keydown", (e) => {
    if(gameOver) return;
    const key = e.key.toLowerCase();
    if(key === "enter") handleKey("enter");
    else if(key === "backspace") handleKey("back");
    else if(/^[a-z]$/.test(key)) handleKey(key);
  });
}

/* ---------- Input & UI ---------- */
function setMessage(msg){ document.getElementById("message").textContent = msg; }

function updateRow(){
  const rowEl = document.getElementsByClassName("row")[currentRow];
  if(!rowEl) return;
  const tiles = rowEl.getElementsByClassName("tile");
  for(let i=0;i<WORD_LEN;i++){
    const ch = currentGuess[i] || "";
    tiles[i].textContent = ch.toUpperCase();
    tiles[i].classList.toggle("filled", !!ch);
  }
}

function handleKey(k){
  if(gameOver) return;
  if(k==="enter"){
    if(currentGuess.length !== WORD_LEN){ setMessage("Need 5 letters 🤏"); return; }
    if(!validWords.has(currentGuess)){ setMessage("Not in word list ❌"); return; }
    submitGuess();
    return;
  }
  if(k==="back"){
    currentGuess = currentGuess.slice(0,-1);
  } else if(/^[a-z]$/.test(k) && currentGuess.length < WORD_LEN){
    currentGuess += k;
  }
  updateRow();
  saveState();
}

/* ---------- Evaluate guesses (true Wordle logic) ---------- */
function evaluateGuess(guess, answer){
  const res = Array(WORD_LEN).fill("absent");
  const counts = {};
  // count letters in answer
  for(const ch of answer){ counts[ch] = (counts[ch]||0) + 1; }
  // first pass: correct
  for(let i=0;i<WORD_LEN;i++){
    if(guess[i] === answer[i]){
      res[i] = "correct";
      counts[guess[i]]--;
    }
  }
  // second pass: present/absent
  for(let i=0;i<WORD_LEN;i++){
    if(res[i] === "correct") continue;
    const ch = guess[i];
    if(counts[ch] > 0){
      res[i] = "present";
      counts[ch]--;
    } else {
      res[i] = "absent";
    }
  }
  return res;
}

function colorKeyboard(guess, res){
  for(let i=0;i<WORD_LEN;i++){
    const ch = guess[i];
    const btn = document.querySelector(`.key[data-key="${ch}"]`);
    if(!btn) continue;
    // priority: correct > present > absent
    if(res[i]==="correct"){ btn.classList.remove("present","absent"); btn.classList.add("correct"); }
    else if(res[i]==="present" && !btn.classList.contains("correct")){ btn.classList.remove("absent"); btn.classList.add("present"); }
    else if(!btn.classList.contains("correct") && !btn.classList.contains("present")){ btn.classList.add("absent"); }
  }
}

function revealRow(rowEl, res){
  const tiles = rowEl.querySelectorAll(".tile");
  tiles.forEach((t,i)=>{
    t.classList.add("flip");
    setTimeout(()=>{
      t.classList.remove("flip");
      t.classList.add(res[i]);
      t.dataset.state = res[i];
    }, i*120);
  });
}

/* ---------- Submit guess ---------- */
function submitGuess(){
  const guess = currentGuess;
  const rowEl = document.getElementsByClassName("row")[currentRow];
  const res = evaluateGuess(guess, secretWord);

  revealRow(rowEl, res);
  colorKeyboard(guess, res);

  if(guess === secretWord){
    setTimeout(()=> endGame(true, currentRow+1), 800);
    gameOver = true;
  } else {
    currentRow++;
    currentGuess = "";
    if(currentRow >= BOARD_ROWS){
      setTimeout(()=> endGame(false, "X"), 300);
      gameOver = true;
      setMessage(`Out of tries! Word was ${secretWord.toUpperCase()} 😵`);
    } else {
      setMessage("");
    }
  }
  saveState();
}

/* ---------- Stats, histogram, share ---------- */
function endGame(won, bucket){
  // update stats
  const stats = getStats();
  stats.played += 1;
  if(won){
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.dist[String(bucket)] += 1;
    setMessage("You win! 🎉");
  } else {
    stats.currentStreak = 0;
    stats.dist["X"] += 1;
  }
  setStats(stats);
  renderStats(stats);
  openStats();

  // fresh puzzle next time
  localStorage.removeItem(LS_STATE);
}

function renderStats(stats = getStats()){
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  document.getElementById("statPlayed").textContent = stats.played;
  document.getElementById("statWinPct").textContent = winPct;
  document.getElementById("statCurrentStreak").textContent = stats.currentStreak;
  document.getElementById("statMaxStreak").textContent = stats.maxStreak;

  const distEl = document.getElementById("dist");
  distEl.innerHTML = "";
  const labels = ["1","2","3","4","5","6","X"];
  const max = Math.max(1, ...labels.map(l => stats.dist[l] || 0));

  labels.forEach(lab=>{
    const count = stats.dist[lab] || 0;
    const row = document.createElement("div");
    row.className = "dist-row";

    const label = document.createElement("div");
    label.className = "dist-label";
    label.textContent = lab;

    const wrap = document.createElement("div");
    wrap.className = "dist-bar-wrap";

    const bar = document.createElement("div");
    bar.className = "dist-bar";
    const pct = Math.max(5, Math.round((count / max) * 100)); // min width
    bar.style.width = pct + "%";
    bar.textContent = count;

    wrap.appendChild(bar);
    row.appendChild(label);
    row.appendChild(wrap);
    distEl.appendChild(row);
  });
}

function openStats(){
  const modal = document.getElementById("statsModal");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
}
function closeStats(){
  const modal = document.getElementById("statsModal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
}

function shareResult(){
  // Recreate emoji grid from the last finished game (from state is gone after endGame)
  // So we rebuild using the board that’s currently visible (final state).
  const rows = [...document.querySelectorAll(".row")];
  const lines = rows.map(r=>{
    const tiles = [...r.querySelectorAll(".tile")];
    if(!tiles.some(t=>t.textContent)) return null;
    return tiles.map(t=>{
      const st = t.dataset.state;
      if(st==="correct") return "🟩";
      if(st==="present") return "🟨";
      if(st==="absent") return "⬛";
      return "⬛";
    }).join("");
  }).filter(Boolean);

  const text = `Wordle — ${new Date().toLocaleDateString()}\n` + lines.join("\n");
  navigator.clipboard?.writeText(text).then(()=> setMessage("Copied result to clipboard 📋"));
}

/* ---------- New game ---------- */
function newGame(){
  // Start a fresh random answer
  secretWord = possibleAnswers[Math.floor(Math.random()*possibleAnswers.length)];
  // reset grid
  setupBoard();
  currentRow = 0;
  currentGuess = "";
  gameOver = false;
  setMessage("");
  saveState();
  // keep keyboard colors (like Wordle), or clear if you want:
  // document.querySelectorAll(".key").forEach(k=>k.classList.remove("correct","present","absent"));
}

/* ---------- Init ---------- */
window.addEventListener("load", async ()=>{
  setupBoard();
  setupKeyboard();
  await loadWords();

  const hadState = loadStateIfAny();
  if(!hadState){
    // choose a fresh secret only when no saved game
    secretWord = possibleAnswers[Math.floor(Math.random()*possibleAnswers.length)];
    saveState();
  }

  // UI wiring
  document.getElementById("statsBtn").addEventListener("click", ()=>{ renderStats(); openStats(); });
  document.getElementById("closeStatsBtn").addEventListener("click", closeStats);
  document.getElementById("okBtn").addEventListener("click", closeStats);
  document.getElementById("shareBtn").addEventListener("click", shareResult);
  document.getElementById("newGameBtn").addEventListener("click", ()=>{
    if(!gameOver){
      if(!confirm("Start a new game? Your current round will be lost.")) return;
    }
    newGame();
  });
});
