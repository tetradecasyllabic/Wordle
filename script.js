let validWords = [];
let possibleAnswers = [];
let secretWord = "";
let currentRow = 0;
let currentGuess = "";

// Load word lists
async function loadWords() {
  const valid = await fetch("validwords.txt").then(r => r.text());
  const answers = await fetch("possibleanswers.txt").then(r => r.text());

  validWords = valid.split("\n").map(w => w.trim().toLowerCase()).filter(Boolean);
  possibleAnswers = answers.split("\n").map(w => w.trim().toLowerCase()).filter(Boolean);

  secretWord = possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];
  console.log("Secret word (debug):", secretWord); // remove later
}

function setupBoard() {
  const board = document.getElementById("game-board");
  for (let i = 0; i < 6; i++) {
    const row = document.createElement("div");
    row.classList.add("row");
    for (let j = 0; j < 5; j++) {
      const tile = document.createElement("div");
      tile.classList.add("tile");
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function setupKeyboard() {
  const keyboard = document.getElementById("keyboard");
  const keys = "qwertyuiopasdfghjklzxcvbnm".split("");
  keys.push("enter", "back");

  keys.forEach(key => {
    const btn = document.createElement("button");
    btn.textContent = key;
    btn.classList.add("key");
    btn.onclick = () => handleKey(key);
    keyboard.appendChild(btn);
  });

  document.addEventListener("keydown", e => {
    if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
    if (e.key === "Enter") handleKey("enter");
    if (e.key === "Backspace") handleKey("back");
  });
}

function handleKey(key) {
  if (key === "enter") {
    if (currentGuess.length === 5) submitGuess();
    return;
  }
  if (key === "back") {
    currentGuess = currentGuess.slice(0, -1);
  } else if (currentGuess.length < 5 && /^[a-z]$/.test(key)) {
    currentGuess += key;
  }
  updateBoard();
}

function updateBoard() {
  const row = document.getElementsByClassName("row")[currentRow];
  const tiles = row.getElementsByClassName("tile");
  for (let i = 0; i < 5; i++) {
    tiles[i].textContent = currentGuess[i] || "";
  }
}

function submitGuess() {
  if (!validWords.includes(currentGuess) && !possibleAnswers.includes(currentGuess)) {
    showMessage("Not in word list ❌");
    return;
  }

  const row = document.getElementsByClassName("row")[currentRow];
  const tiles = row.getElementsByClassName("tile");

  for (let i = 0; i < 5; i++) {
    const letter = currentGuess[i];
    if (letter === secretWord[i]) {
      tiles[i].classList.add("correct");
    } else if (secretWord.includes(letter)) {
      tiles[i].classList.add("present");
    } else {
      tiles[i].classList.add("absent");
    }
  }

  if (currentGuess === secretWord) {
    showMessage("You win! 🎉");
    return;
  }

  currentRow++;
  currentGuess = "";

  if (currentRow >= 6) {
    showMessage("Game over! The word was: " + secretWord.toUpperCase());
  }
}

function showMessage(msg) {
  document.getElementById("message").textContent = msg;
}

window.onload = async () => {
  setupBoard();
  setupKeyboard();
  await loadWords();
};
