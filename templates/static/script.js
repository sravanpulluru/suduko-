(() => {
  const SIZE = 9;

  const form = document.getElementById("sudokuForm");
  const statusEl = document.getElementById("status");
  const btnSolve = document.getElementById("btnSolve");
  const btnGenerate = document.getElementById("btnGenerate");
  const btnReset = document.getElementById("btnReset");

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function clampDigit(value) {
    if (value === "" || value === null || value === undefined) return "";
    const s = String(value).trim();
    if (!s) return "";
    const ch = s[s.length - 1];
    if (!/^[1-9]$/.test(ch)) return "";
    return ch;
  }

  function buildGrid() {
    const frag = document.createDocumentFragment();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const input = document.createElement("input");
        input.className = "cell";
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.maxLength = 1;
        input.ariaLabel = `Row ${r + 1} Column ${c + 1}`;
        input.dataset.r = String(r);
        input.dataset.c = String(c);

        // thick borders to separate 3x3 blocks
        if (c === 2 || c === 5) input.classList.add("thick-right");
        if (r === 2 || r === 5) input.classList.add("thick-bottom");

        input.addEventListener("input", () => {
          const v = clampDigit(input.value);
          input.value = v;
          validateAndMark();
        });

        input.addEventListener("keydown", (e) => {
          const key = e.key;
          const r0 = Number(input.dataset.r);
          const c0 = Number(input.dataset.c);

          const move = (nr, nc) => {
            const next = form.querySelector(`.cell[data-r="${nr}"][data-c="${nc}"]`);
            if (next) next.focus();
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
          } else if (key === "Backspace" || key === "Delete") {
            // allow
          } else if (key.length === 1 && !/^[1-9]$/.test(key)) {
            e.preventDefault();
          }
        });

        frag.appendChild(input);
      }
    }
    form.replaceChildren(frag);
  }

  function getCells() {
    return Array.from(form.querySelectorAll(".cell"));
  }

  function getBoardFromGrid() {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    for (const cell of getCells()) {
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const v = clampDigit(cell.value);
      board[r][c] = v ? Number(v) : 0;
    }
    return board;
  }

  function setBoardToGrid(board, { markFixed = false } = {}) {
    const cells = getCells();
    for (const cell of cells) {
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      const v = board[r][c];
      cell.value = v ? String(v) : "";
      if (markFixed) {
        if (v) cell.classList.add("fixed");
        else cell.classList.remove("fixed");
      }
      cell.classList.remove("invalid");
    }
    validateAndMark();
  }

  function clearGrid() {
    for (const cell of getCells()) {
      cell.value = "";
      cell.classList.remove("invalid", "fixed");
    }
    setStatus("Ready.");
  }

  function validateAndMark() {
    const cells = getCells();
    for (const cell of cells) cell.classList.remove("invalid");

    const board = getBoardFromGrid();

    const markInvalid = (positions) => {
      for (const [r, c] of positions) {
        const el = form.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (el) el.classList.add("invalid");
      }
    };

    // Rows
    for (let r = 0; r < 9; r++) {
      const seen = new Map();
      for (let c = 0; c < 9; c++) {
        const v = board[r][c];
        if (!v) continue;
        const key = String(v);
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push([r, c]);
      }
      for (const positions of seen.values()) {
        if (positions.length > 1) markInvalid(positions);
      }
    }

    // Cols
    for (let c = 0; c < 9; c++) {
      const seen = new Map();
      for (let r = 0; r < 9; r++) {
        const v = board[r][c];
        if (!v) continue;
        const key = String(v);
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push([r, c]);
      }
      for (const positions of seen.values()) {
        if (positions.length > 1) markInvalid(positions);
      }
    }

    // Boxes
    for (let br = 0; br < 9; br += 3) {
      for (let bc = 0; bc < 9; bc += 3) {
        const seen = new Map();
        for (let r = br; r < br + 3; r++) {
          for (let c = bc; c < bc + 3; c++) {
            const v = board[r][c];
            if (!v) continue;
            const key = String(v);
            if (!seen.has(key)) seen.set(key, []);
            seen.get(key).push([r, c]);
          }
        }
        for (const positions of seen.values()) {
          if (positions.length > 1) markInvalid(positions);
        }
      }
    }

    const invalidCount = form.querySelectorAll(".cell.invalid").length;
    if (invalidCount > 0) {
      setStatus(`Fix ${invalidCount} conflicting cell${invalidCount === 1 ? "" : "s"} to continue.`);
      return false;
    }
    setStatus("Ready.");
    return true;
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const msg = data && data.error ? data.error : `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function getJSON(url) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const msg = data && data.error ? data.error : `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  function setBusy(isBusy) {
    btnSolve.disabled = isBusy;
    btnGenerate.disabled = isBusy;
    btnReset.disabled = isBusy;
    btnSolve.style.opacity = isBusy ? "0.75" : "1";
    btnGenerate.style.opacity = isBusy ? "0.75" : "1";
    btnReset.style.opacity = isBusy ? "0.75" : "1";
  }

  btnSolve.addEventListener("click", async () => {
    if (!validateAndMark()) return;
    setBusy(true);
    setStatus("Solving...");
    try {
      const board = getBoardFromGrid();
      // Backend endpoints in this project are /api/solve and /api/generate
      const data = await postJSON("/api/solve", { board });
      setBoardToGrid(data.solution, { markFixed: false });
      setStatus("Solved.");
    } catch (e) {
      setStatus(e.message || "Unable to solve.");
    } finally {
      setBusy(false);
    }
  });

  btnGenerate.addEventListener("click", async () => {
    setBusy(true);
    setStatus("Generating puzzle...");
    try {
      const data = await getJSON("/api/generate?difficulty=medium");
      setBoardToGrid(data.puzzle, { markFixed: true });
      setStatus("Puzzle generated.");
    } catch (e) {
      setStatus(e.message || "Unable to generate puzzle.");
    } finally {
      setBusy(false);
    }
  });

  btnReset.addEventListener("click", () => {
    clearGrid();
  });

  form.addEventListener("submit", (e) => e.preventDefault());

  // Init
  buildGrid();
  clearGrid();
})();

