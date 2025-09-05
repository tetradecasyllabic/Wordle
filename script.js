const BOARD_ROWS = 6;
const WORD_LEN = 5;

let validWords = new Set();
let possibleAnswers = [];
let secretWord = "";

let currentRow = 0;
let currentGuess = "";
let gameOver = false;

const LS_STATS = "wordle_stats_v2";

function defaultStats() {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    dist: { "1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"X":0 }
  };
}
function getStats(){ return JSON.parse(localStorage.getItem(LS_STATS)) || defaultStats(); }
function setStats(s){ localStorage.setItem(LS_STATS, JSON.stringify(s)); }

async function loadWords() {
  const valid = await fetch("validwords.txt").then(r => r.text());
  const answers = await fetch("possibleanswers.txt").then(r => r.text());
  const clean = s => s.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean);
  clean(valid).forEach(w => validWords.add(w));
  possibleAnswers = clean(answers);
}

function setupBoard() {
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
  const rows = ["qwertyuiop","asdfghjkl","zxcvbnm"];
  const keyboard = document.getElementById("keyboard");
  keyboard.innerHTML = "";
  rows[0].split("").forEach(k => addKey(k));
  rows[1].split("").forEach(k => addKey(k));
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

  document.addEventListener("keydown", e=>{
    if(gameOver) return;
    const key = e.key.toLowerCase();
    if(key==="enter") handleKey("enter");
    else if(key==="backspace") handleKey("back");
    else if(/^[a-z]$/.test(key)) handleKey(key);
  });
}

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
  if(k==="back") currentGuess = currentGuess.slice(0,-1);
  else if(/^[a-z]$/.test(k) && currentGuess.length<WORD_LEN) currentGuess += k;
  updateRow();
}

function evaluateGuess(guess, answer){
  const res = Array(WORD_LEN).fill("absent");
  const counts = {};
  for(const ch of answer) counts[ch] = (counts[ch]||0)+1;
  for(let i=0;i<WORD_LEN;i++){
    if(guess[i]===answer[i]){ res[i]="correct"; counts[guess[i]]--; }
  }
  for(let i=0;i<WORD_LEN;i++){
    if(res[i]==="correct") continue;
    const ch = guess[i];
    if(counts[ch]>0){ res[i]="present"; counts[ch]--; }
  }
  return res;
}

function colorKeyboard(guess, res){
  for(let i=0;i<WORD_LEN;i++){
    const ch = guess[i];
    const btn=document.querySelector(`.key[data-key="${ch}"]`);
    if(!btn) continue;
    if(res[i]==="correct"){ btn.classList.remove("present","absent"); btn.classList.add("correct"); }
    else if(res[i]==="present" && !btn.classList.contains("correct")){ btn.classList.add("present"); }
    else if(!btn.classList.contains("correct") && !btn.classList.contains("present")) btn.classList.add("absent");
  }
}

function revealRow(rowEl,res){
  const tiles=rowEl.querySelectorAll(".tile");
  tiles.forEach((t,i)=>{
    setTimeout(()=>{
      t.classList.add(res[i]);
    }, i*300);
  });
}

function submitGuess(){
  const guess=currentGuess;
  const rowEl=document.getElementsByClassName("row")[currentRow];
  const res=evaluateGuess(guess,secretWord);
  revealRow(rowEl,res);
  colorKeyboard(guess,res);
  if(guess===secretWord){
    setTimeout(()=> endGame(true,currentRow+1),1800);
    gameOver=true;
  }else{
    currentRow++;
    currentGuess="";
    if(currentRow>=BOARD_ROWS){
      setTimeout(()=> endGame(false,"X"),1200);
      gameOver=true;
      setMessage(`Word was ${secretWord.toUpperCase()} 😵`);
    }
  }
}

function endGame(won,bucket){
  const stats=getStats();
  stats.played++;
  if(won){
    stats.wins++;
    stats.currentStreak++;
    stats.maxStreak=Math.max(stats.maxStreak,stats.currentStreak);
    stats.dist[String(bucket)]++;
    setMessage("You win! 🎉");
  }else{
    stats.currentStreak=0;
    stats.dist["X"]++;
  }
  setStats(stats);
  renderStats(stats);
  openStats();
  startRestartCountdown();
}

function renderStats(stats=getStats()){
  const winPct=stats.played?Math.round((stats.wins/stats.played)*100):0;
  document.getElementById("statPlayed").textContent=stats.played;
  document.getElementById("statWinPct").textContent=winPct;
  document.getElementById("statCurrentStreak").textContent=stats.currentStreak;
  document.getElementById("statMaxStreak").textContent=stats.maxStreak;
  const distEl=document.getElementById("dist");
  distEl.innerHTML="";
  const labels=["1","2","3","4","5","6","X"];
  const max=Math.max(1,...labels.map(l=>stats.dist[l]||0));
  labels.forEach(lab=>{
    const count=stats.dist[lab]||0;
    const row=document.createElement("div");
    row.className="dist-row";
    const label=document.createElement("div");
    label.className="dist-label";
    label.textContent=lab;
    const wrap=document.createElement("div");
    wrap.className="dist-bar-wrap";
    const bar=document.createElement("div");
    bar.className="dist-bar";
    bar.style.width=(count/max*100)+"%";
    bar.textContent=count;
    wrap.appendChild(bar);
    row.appendChild(label);
    row.appendChild(wrap);
    distEl.appendChild(row);
  });
}

function openStats(){ document.getElementById("statsModal").classList.add("show"); }
function closeStats(){ document.getElementById("statsModal").classList.remove("show"); }

function newGame(){
  secretWord=possibleAnswers[Math.floor(Math.random()*possibleAnswers.length)];
  setupBoard();
  currentRow=0;
  currentGuess="";
  gameOver=false;
  setMessage("");
  document.querySelectorAll(".key").forEach(k=>k.classList.remove("correct","present","absent"));
}

function startRestartCountdown(){
  let seconds=5;
  const timer=document.getElementById("restartTimer");
  timer.textContent=`New game in ${seconds}…`;
  const interval=setInterval(()=>{
    seconds--;
    if(seconds<=0){
      clearInterval(interval);
      timer.textContent="";
      closeStats();
      newGame();
    }else{
      timer.textContent=`New game in ${seconds}…`;
    }
  },1000);
}

window.addEventListener("load",async()=>{
  setupBoard();
  setupKeyboard();
  await loadWords();
  newGame();
  document.getElementById("statsBtn").addEventListener("click",()=>{renderStats();openStats();});
  document.getElementById("closeStatsBtn").addEventListener("click",closeStats);
});
