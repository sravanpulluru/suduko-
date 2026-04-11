// static/script.js
(() => {
  const SIZE = 9;
  const MAX_MISTAKES = 3;
  const SOLVE_STEP_MS = 30;

  const form = document.getElementById("sudokuForm");
  const boardCard = document.getElementById("boardCard");
  const statusEl = document.getElementById("status");
  const timerDisplay = document.getElementById("timerDisplay");
  const mistakesDisplay = document.getElementById("mistakesDisplay");
  const scoreDisplay = document.getElementById("scoreDisplay");
  const diffButtons = document.querySelectorAll(".diff-btn");
  const keypadButtons = document.querySelectorAll(".keypad-btn");

  const btnNewGame = document.getElementById("btnNewGame");
  const btnHint = document.getElementById("btnHint");
  const btnUndo = document.getElementById("btnUndo");
  const btnSolve = document.getElementById("btnSolve");
  const btnReset = document.getElementById("btnReset");

  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalText = document.getElementById("modalText");
  const modalPrimaryBtn = document.getElementById("modalPrimaryBtn");
  const modalCloseBtn = document.getElementById("modalCloseBtn");

  const confettiCanvas = document.getElementById("confettiCanvas");
  const confettiCtx = confettiCanvas.getContext("2d");

  let solutionBoard = null;
  let currentDifficulty = null;
  let mistakes = 0;
  let timerId = null;
  let gameStartedAt = null;
  let gameLocked = false;
  let selectedCell = null;
  const undoStack = [];
  let audioCtx = null;

  let confettiPieces = [];
  let confettiRunning = false;
  let modalPrimaryAction = null;

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function clampDigit(value) {
    if (value === "" || value === null || value === undefined) return "";
    const s = String(value).trim();
    if (!s) return "";
    const ch = s[s.length - 1];
    return /^[1-9]$/.test(ch) ? ch : "";
  }

  function setDifficultyUI(level) {
    diffButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.level === level));
  }

  function getCell(r, c) {
    return form.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  }

  function getCells() {
    return Array.from(form.querySelectorAll(".cell"));
  }

  function getSelectedCell() {
    if (selectedCell && form.contains(selectedCell)) return selectedCell;
    const active = document.activeElement;
    if (active && active.classList?.contains("cell")) return active;
    return null;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function updateTimerDisplay() {
    if (!gameStartedAt) {
      timerDisplay.textContent = "00:00";
      return;
    }
    const elapsed = Math.floor((Date.now() - gameStartedAt) / 1000);
    timerDisplay.textContent = formatTime(elapsed);
    updateScore();
  }

  function startTimer() {
    stopTimer();
    gameStartedAt = Date.now();
    timerId = window.setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
  }

  function stopTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function updateScore() {
    if (!solutionBoard || !gameStartedAt) {
      scoreDisplay.textContent = "-";
      return;
    }
    const elapsed = Math.floor((Date.now() - gameStartedAt) / 1000);
    const raw = 9000 - elapsed * 8 - mistakes * 520;
    scoreDisplay.textContent = String(Math.max(0, Math.round(raw)));
  }

  function updateMistakesDisplay() {
    mistakesDisplay.textContent = `${Math.min(mistakes, MAX_MISTAKES)} / ${MAX_MISTAKES}`;
  }

  function setBusy(isBusy) {
    [btnNewGame, btnHint, btnUndo, btnSolve, btnReset].forEach((b) => {
      b.disabled = isBusy;
    });
    diffButtons.forEach((b) => {
      b.disabled = isBusy;
    });
    keypadButtons.forEach((b) => {
      b.disabled = isBusy;
    });
  }

  function clearHighlights() {
    getCells().forEach((cell) => cell.classList.remove("selected", "highlight-peer"));
  }

  function applyHighlights(cell) {
    clearHighlights();
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;

    cell.classList.add("selected");

    getCells().forEach((el) => {
      if (el === cell) return;
      const cr = Number(el.dataset.r);
      const cc = Number(el.dataset.c);
      if (cr === r || cc === c || (cr >= br && cr < br + 3 && cc >= bc && cc < bc + 3)) {
        el.classList.add("highlight-peer");
      }
    });
  }

  function updateKeypadHighlight() {
    const cell = getSelectedCell();
    const activeDigit = cell ? clampDigit(cell.value) : "";
    keypadButtons.forEach((btn) => {
      btn.classList.toggle("active-number", activeDigit !== "" && btn.dataset.digit === activeDigit);
    });
  }

  function pushUndo(r, c, oldVal, newVal) {
    undoStack.push({ r, c, oldVal: oldVal || "", newVal: newVal || "" });
    if (undoStack.length > 150) undoStack.shift();
  }

  function resetGameState() {
    stopTimer();
    gameStartedAt = null;
    solutionBoard = null;
    currentDifficulty = null;
    mistakes = 0;
    gameLocked = false;
    selectedCell = null;
    undoStack.length = 0;
    setDifficultyUI(null);
    timerDisplay.textContent = "00:00";
    scoreDisplay.textContent = "-";
    updateMistakesDisplay();
  }

  function lockEditableCells(lock) {
    gameLocked = lock;
    getCells().forEach((cell) => {
      if (cell.classList.contains("fixed")) return;
      cell.readOnly = lock;
      cell.classList.toggle("locked", lock);
    });
  }

  function markCellInvalid(cell) {
    cell.classList.add("invalid");
    window.setTimeout(() => cell.classList.remove("invalid"), 340);
  }

  function markCellValid(cell) {
    cell.classList.add("valid-flash");
    window.setTimeout(() => cell.classList.remove("valid-flash"), 260);
  }

  function markCellPop(cell) {
    cell.classList.add("pop-in");
    window.setTimeout(() => cell.classList.remove("pop-in"), 220);
  }

  function buildGrid() {
    const frag = document.createDocumentFragment();

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const input = document.createElement("input");
        input.className = "cell";
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 1;
        input.autocomplete = "off";
        input.dataset.r = String(r);
        input.dataset.c = String(c);
        input.ariaLabel = `Row ${r + 1} column ${c + 1}`;

        if (c === 2 || c === 5) input.classList.add("thick-right");
        if (r === 2 || r === 5) input.classList.add("thick-bottom");

        input.addEventListener("focus", () => {
          selectedCell = input;
          applyHighlights(input);
          updateKeypadHighlight();
        });

        input.addEventListener("pointerdown", () => {
          selectedCell = input;
        });

        input.addEventListener("keydown", (e) => {
          const key = e.key;
          const r0 = Number(input.dataset.r);
          const c0 = Number(input.dataset.c);

          const move = (nr, nc) => {
            const next = getCell(nr, nc);
            if (next) {
              selectedCell = next;
              next.focus();
            }
          };

          if (key === "ArrowUp") {
            e.preventDefault();
            move(Math.max(0, r0 - 1), c0);
          } else if (key === "ArrowDown") {
            e.preventDefault();
            move(Math.min(8, r0 + 1), c0);
          } else if (key === "ArrowLeft") {
            e.preventDefault();
            move(r0, Math.max(0, c0 - 1));
          } else if (key === "ArrowRight") {
            e.preventDefault();
            move(r0, Math.min(8, c0 + 1));
          } else if (key.length === 1 && !/^[1-9]$/.test(key)) {
            e.preventDefault();
          }
        });

        input.addEventListener("beforeinput", () => {
          input.dataset.prev = input.value;
        });

        input.addEventListener("input", () => {
          if (gameLocked) {
            input.value = input.dataset.prev || "";
            return;
          }
          const prev = input.dataset.prev || "";
          const next = clampDigit(input.value);
          input.value = next;
          if (prev !== next) {
            pushUndo(Number(input.dataset.r), Number(input.dataset.c), prev, next);
          }
          onCellChanged(input, prev, next);
        });

        frag.appendChild(input);
      }
    }

    form.replaceChildren(frag);
  }

  function getBoardFromGrid() {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    getCells().forEach((cell) => {
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const v = clampDigit(cell.value);
      board[r][c] = v ? Number(v) : 0;
    });
    return board;
  }

  function setBoardToGrid(board, { markFixed = false } = {}) {
    getCells().forEach((cell) => {
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const v = board[r][c];

      cell.value = v ? String(v) : "";
      cell.classList.remove("invalid", "valid-flash", "locked");

      if (markFixed) {
        if (v) {
          cell.classList.add("fixed");
          cell.readOnly = true;
        } else {
          cell.classList.remove("fixed");
          cell.readOnly = false;
        }
      }
    });
  }

  function computeInvalidPositions(board) {
    const invalid = new Set();

    function mark(r, c) {
      invalid.add(`${r},${c}`);
    }

    for (let r = 0; r < 9; r++) {
      const seen = new Map();
      for (let c = 0; c < 9; c++) {
        const v = board[r][c];
        if (!v) continue;
        if (!seen.has(v)) seen.set(v, []);
        seen.get(v).push([r, c]);
      }
      for (const list of seen.values()) {
        if (list.length > 1) list.forEach(([rr, cc]) => mark(rr, cc));
      }
    }

    for (let c = 0; c < 9; c++) {
      const seen = new Map();
      for (let r = 0; r < 9; r++) {
        const v = board[r][c];
        if (!v) continue;
        if (!seen.has(v)) seen.set(v, []);
        seen.get(v).push([r, c]);
      }
      for (const list of seen.values()) {
        if (list.length > 1) list.forEach(([rr, cc]) => mark(rr, cc));
      }
    }

    for (let br = 0; br < 9; br += 3) {
      for (let bc = 0; bc < 9; bc += 3) {
        const seen = new Map();
        for (let r = br; r < br + 3; r++) {
          for (let c = bc; c < bc + 3; c++) {
            const v = board[r][c];
            if (!v) continue;
            if (!seen.has(v)) seen.set(v, []);
            seen.get(v).push([r, c]);
          }
        }
        for (const list of seen.values()) {
          if (list.length > 1) list.forEach(([rr, cc]) => mark(rr, cc));
        }
      }
    }

    return invalid;
  }

  function applyConflictHighlight(board) {
    getCells().forEach((cell) => cell.classList.remove("invalid"));
    const invalid = computeInvalidPositions(board);
    invalid.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      const cell = getCell(r, c);
      if (cell) cell.classList.add("invalid");
    });
    return invalid.size;
  }

  function onCellChanged(cell, prev, next) {
    markCellPop(cell);

    const board = getBoardFromGrid();
    const conflicts = applyConflictHighlight(board);

    if (solutionBoard && !cell.classList.contains("fixed")) {
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);

      if (next !== "") {
        if (Number(next) === solutionBoard[r][c] && conflicts === 0) {
          markCellValid(cell);
          playSound("good");
        } else {
          mistakes += 1;
          updateMistakesDisplay();
          markCellInvalid(cell);
          playSound("error");
          if (mistakes >= MAX_MISTAKES) {
            handleGameOver();
            return;
          }
        }
      }
    }

    if (conflicts > 0) {
      setStatus(`Fix ${conflicts} conflicting cell${conflicts === 1 ? "" : "s"}.`);
    } else if (!gameLocked) {
      setStatus("Keep going...");
    }

    updateScore();
    updateKeypadHighlight();
    checkWin();
  }

  async function getJSON(url) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function loadPuzzle(level) {
    setBusy(true);
    setStatus("Generating puzzle...");
    try {
      const data = await getJSON(`/api/generate?level=${encodeURIComponent(level)}`);
      resetBoardOnly();
      solutionBoard = data.solution;
      currentDifficulty = data.difficulty || level;
      setDifficultyUI(currentDifficulty);
      setBoardToGrid(data.puzzle, { markFixed: true });
      mistakes = 0;
      updateMistakesDisplay();
      lockEditableCells(false);
      startTimer();
      updateScore();
      setStatus(`${currentDifficulty[0].toUpperCase()}${currentDifficulty.slice(1)} puzzle ready.`);
      playSound("click");
    } catch (e) {
      setStatus(e.message || "Unable to generate puzzle.");
      playSound("error");
    } finally {
      setBusy(false);
    }
  }

  function resetBoardOnly() {
    stopTimer();
    gameLocked = false;
    undoStack.length = 0;
    boardCard.classList.remove("board-solved");
    getCells().forEach((cell) => {
      cell.value = "";
      cell.readOnly = false;
      cell.classList.remove(
        "fixed",
        "invalid",
        "selected",
        "highlight-peer",
        "locked",
        "valid-flash",
        "pop-in"
      );
    });
  }

  async function solveWithAnimation(solution) {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        cells.push([r, c]);
      }
    }

    for (const [r, c] of cells) {
      const cell = getCell(r, c);
      const want = String(solution[r][c]);
      if (cell.value !== want) {
        cell.value = want;
        cell.classList.remove("fixed", "locked", "invalid");
        cell.readOnly = false;
        cell.classList.add("pop-in");
        window.setTimeout(() => cell.classList.remove("pop-in"), 220);
        await new Promise((res) => setTimeout(res, SOLVE_STEP_MS));
      }
    }
  }

  function checkWin() {
    if (!solutionBoard || gameLocked) return false;

    const board = getBoardFromGrid();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== solutionBoard[r][c]) return false;
      }
    }

    stopTimer();
    boardCard.classList.add("board-solved");
    lockEditableCells(true);
    setStatus("Puzzle completed!");
    playSound("success");
    startConfetti();
    showModal({
      title: "You Win!",
      text: "Amazing solve. Ready for another challenge?",
      primaryText: "Play Again",
      onPrimary: () => loadPuzzle(currentDifficulty || "medium"),
    });
    return true;
  }

  function highlightIncorrectCells() {
    if (!solutionBoard) return;
    getCells().forEach((cell) => {
      if (cell.classList.contains("fixed")) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const v = clampDigit(cell.value);
      if (v && Number(v) !== solutionBoard[r][c]) {
        cell.classList.add("invalid");
      }
    });
  }

  function handleGameOver() {
    lockEditableCells(true);
    stopTimer();
    highlightIncorrectCells();
    setStatus("Game Over - 3 mistakes reached.");
    playSound("error");
    showModal({
      title: "Game Over",
      text: "You reached 3 mistakes. Try again?",
      primaryText: "Restart Game",
      onPrimary: () => loadPuzzle(currentDifficulty || "medium"),
    });
  }

  function showModal({ title, text, primaryText, onPrimary }) {
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalPrimaryBtn.textContent = primaryText || "OK";
    modalPrimaryAction = onPrimary || null;
    modalOverlay.classList.add("show");
    modalOverlay.setAttribute("aria-hidden", "false");
  }

  function hideModal() {
    modalOverlay.classList.remove("show");
    modalOverlay.setAttribute("aria-hidden", "true");
  }

  function playSound(kind) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      let freq = 480;
      let dur = 0.08;

      if (kind === "error") {
        freq = 190;
        dur = 0.12;
      } else if (kind === "success") {
        freq = 720;
        dur = 0.14;
      } else if (kind === "good") {
        freq = 560;
        dur = 0.09;
      } else if (kind === "click") {
        freq = 420;
        dur = 0.06;
      }

      const t0 = audioCtx.currentTime;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    } catch (_) {
      /* ignore sound failures */
    }
  }

  function resizeConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }

  function startConfetti() {
    resizeConfetti();
    confettiPieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * -confettiCanvas.height,
      w: 4 + Math.random() * 6,
      h: 6 + Math.random() * 8,
      speedY: 1.2 + Math.random() * 2.6,
      speedX: -1 + Math.random() * 2,
      rot: Math.random() * Math.PI * 2,
      rotSpd: -0.12 + Math.random() * 0.24,
      color: ["#7f8cff", "#9d6bff", "#55d5ff", "#2dd4bf", "#ffffff"][Math.floor(Math.random() * 5)],
    }));
    if (!confettiRunning) {
      confettiRunning = true;
      requestAnimationFrame(confettiLoop);
    }
    setTimeout(() => {
      confettiRunning = false;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }, 4200);
  }

  function confettiLoop() {
    if (!confettiRunning) return;

    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    for (const p of confettiPieces) {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rot += p.rotSpd;

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();

      if (p.y > confettiCanvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * confettiCanvas.width;
      }
    }

    requestAnimationFrame(confettiLoop);
  }

  function insertDigit(digit) {
    if (gameLocked) {
      playSound("error");
      return;
    }
    const cell = getSelectedCell();
    if (!cell) {
      setStatus("Select a cell first.");
      playSound("error");
      return;
    }
    if (cell.classList.contains("fixed")) {
      playSound("error");
      return;
    }
    const prev = cell.value;
    const next = clampDigit(digit);
    if (prev === next) return;

    pushUndo(Number(cell.dataset.r), Number(cell.dataset.c), prev, next);
    cell.value = next;
    onCellChanged(cell, prev, next);
    cell.focus();
    updateKeypadHighlight();
    playSound("click");
  }

  function undoMove() {
    if (!undoStack.length) {
      setStatus("Nothing to undo.");
      return;
    }
    const last = undoStack.pop();
    const cell = getCell(last.r, last.c);
    if (!cell || cell.classList.contains("fixed")) return;

    if (gameLocked && mistakes >= MAX_MISTAKES) {
      lockEditableCells(false);
    }

    cell.value = last.oldVal;
    const board = getBoardFromGrid();
    applyConflictHighlight(board);

    mistakes = Math.max(0, mistakes - 1);
    updateMistakesDisplay();
    updateScore();
    checkWin();
    setStatus("Undid last move.");
    playSound("click");
  }

  async function giveHint() {
    if (!solutionBoard || gameLocked) {
      setStatus("Start a game to use hints.");
      return;
    }

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = getCell(r, c);
        if (cell.classList.contains("fixed")) continue;

        const current = clampDigit(cell.value);
        const correct = String(solutionBoard[r][c]);
        if (current !== correct) {
          pushUndo(r, c, current, correct);
          cell.value = correct;
          markCellValid(cell);
          markCellPop(cell);
          selectedCell = cell;
          cell.focus();
          playSound("good");
          applyConflictHighlight(getBoardFromGrid());
          checkWin();
          setStatus("Hint placed.");
          return;
        }
      }
    }

    setStatus("No hint needed.");
  }

  async function solvePuzzle() {
    if (gameLocked && mistakes >= MAX_MISTAKES) {
      lockEditableCells(false);
    }

    const board = getBoardFromGrid();
    const conflicts = applyConflictHighlight(board);
    if (conflicts > 0) {
      setStatus("Fix conflicts before solving.");
      playSound("error");
      return;
    }

    setBusy(true);
    setStatus("Solving...");
    try {
      const data = await postJSON("/api/solve", { board });
      await solveWithAnimation(data.solution);
      stopTimer();
      solutionBoard = data.solution;
      boardCard.classList.add("board-solved");
      lockEditableCells(true);
      setStatus("Solved.");
      playSound("success");
    } catch (e) {
      setStatus(e.message || "Unable to solve.");
      playSound("error");
    } finally {
      setBusy(false);
    }
  }

  function clearBoard() {
    getCells().forEach((cell) => {
      if (cell.classList.contains("fixed")) return;
      cell.value = "";
      cell.classList.remove("invalid", "valid-flash", "pop-in");
    });
    undoStack.length = 0;
    mistakes = 0;
    updateMistakesDisplay();
    updateScore();
    applyConflictHighlight(getBoardFromGrid());
    setStatus("Board reset.");
    if (solutionBoard && !gameLocked) playSound("click");
  }

  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => loadPuzzle(btn.dataset.level));
  });

  keypadButtons.forEach((btn) => {
    btn.addEventListener("click", () => insertDigit(btn.dataset.digit));
  });

  btnNewGame.addEventListener("click", () => {
    loadPuzzle(currentDifficulty || "medium");
  });

  btnHint.addEventListener("click", giveHint);
  btnUndo.addEventListener("click", undoMove);
  btnSolve.addEventListener("click", solvePuzzle);
  btnReset.addEventListener("click", clearBoard);

  modalPrimaryBtn.addEventListener("click", () => {
    hideModal();
    if (modalPrimaryAction) modalPrimaryAction();
  });

  modalCloseBtn.addEventListener("click", hideModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) hideModal();
  });

  form.addEventListener(
    "focusout",
    () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || !form.contains(active)) {
          clearHighlights();
        } else {
          applyHighlights(active);
        }
      });
    },
    true
  );

  form.addEventListener("submit", (e) => e.preventDefault());
  window.addEventListener("resize", resizeConfetti);

  buildGrid();
  resetGameState();
  setStatus("Choose a difficulty to start.");
})();