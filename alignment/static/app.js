// Frontend for the EDTA visualizer.
// The DP table and the traceback path come from the Python backend (POST /api/align);
// this file only draws them and steps through them.
(function () {
  const $ = (id) => document.getElementById(id);
  const OPS = { match: "Match", sub: "Substitution", ins: "Insertion", del: "Deletion" };
  const ARROW = { match: "↖", sub: "↖", ins: "←", del: "↑" };

  let S = "", T = "", m = 0, n = 0, dp = [], moves = [], result = null;
  let total = 0, step = 0, timer = null;
  let cells = [], rowHdr = [], colHdr = [];

  // ---- backend ----
  async function load(s, t) {
    stop();
    let data;
    try {
      const res = await fetch("/api/align", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s, t }),
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.error || `The server returned ${res.status}.`);
    } catch (err) {
      showError(err instanceof TypeError
        ? "Can't reach the Python server. Start it with: python server.py, then open http://localhost:8000"
        : err.message);
      return;
    }
    showError("");

    S = data.s; T = data.t; m = S.length; n = T.length; dp = data.dp; result = data;
    // Turn the backend's path into moves, adding the neighbour values the explanation panel shows
    moves = data.path.map(({ i, j, op }) => {
      const cost = i > 0 && j > 0 ? (S[i - 1] === T[j - 1] ? 0 : 1) : null;
      return {
        i, j, v: dp[i][j], type: op, cost,
        left: j > 0 ? dp[i][j - 1] + 1 : null,
        diag: i > 0 && j > 0 ? dp[i - 1][j - 1] + cost : null,
        up: i > 0 ? dp[i - 1][j] + 1 : null,
        a: op === "ins" ? "-" : S[i - 1],
        b: op === "del" ? "-" : T[j - 1],
      };
    });
    total = m * n + moves.length;
    step = 0;
    $("seqS").value = S; $("seqT").value = T;
    buildGrid();
    $("scrub").max = total;
    render();
  }

  function showError(msg) {
    $("err").textContent = msg;
    $("err").hidden = !msg;
  }

  // ---- table ----
  function buildGrid() {
    const g = $("grid");
    g.innerHTML = "";
    g.style.gridTemplateColumns = `repeat(${n + 3}, var(--cell))`;
    const add = (cls, text) => {
      const d = document.createElement("div");
      d.className = "cell " + cls;
      d.textContent = text;
      g.appendChild(d);
      return d;
    };
    // index row
    add("idx", ""); add("idx", ""); add("idx", "j=0");
    for (let j = 1; j <= n; j++) add("idx", String(j));
    // header row (letters of t)
    add("idx", ""); add("hdr", ""); add("hdr eps", "ε");
    colHdr = [null];
    for (let j = 1; j <= n; j++) colHdr.push(add("hdr", T[j - 1]));
    cells = []; rowHdr = [null];
    for (let i = 0; i <= m; i++) {
      add("idx", i === 0 ? "i=0" : String(i));
      const h = i === 0 ? add("hdr eps", "ε") : add("hdr", S[i - 1]);
      if (i > 0) rowHdr.push(h);
      cells.push([]);
      for (let j = 0; j <= n; j++) {
        const c = add("v", "");
        c.tabIndex = i > 0 && j > 0 ? 0 : -1;
        c.setAttribute("role", "button");
        c.setAttribute("aria-label", `dp[${i}][${j}]`);
        c.dataset.i = i; c.dataset.j = j;
        cells[i].push(c);
      }
    }
  }

  const fillIndex = (i, j) => (i - 1) * n + (j - 1);

  function render() {
    if (!result) return;
    const ph = step === total ? "done" : step <= m * n ? "fill" : "trace";
    const tk = Math.max(0, step - m * n); // number of traceback moves revealed

    for (let i = 0; i <= m; i++)
      for (let j = 0; j <= n; j++) {
        const c = cells[i][j];
        const base = i === 0 || j === 0;
        const filled = base || fillIndex(i, j) < Math.min(step, m * n);
        c.className = "cell v" + (base ? " base" : filled ? " filled" : " empty");
        c.textContent = filled ? dp[i][j] : "";
      }
    rowHdr.forEach((h) => h && h.classList.remove("hl"));
    colHdr.forEach((h) => h && h.classList.remove("hl"));

    if (ph === "fill" && step > 0) {
      const k = step - 1, i = Math.floor(k / n) + 1, j = (k % n) + 1;
      const cost = S[i - 1] === T[j - 1] ? 0 : 1;
      const best = dp[i][j];
      const nbs = [[i - 1, j, dp[i - 1][j] + 1], [i, j - 1, dp[i][j - 1] + 1], [i - 1, j - 1, dp[i - 1][j - 1] + cost]];
      nbs.forEach(([a, b, val]) => {
        cells[a][b].classList.add("nb");
        if (val === best) cells[a][b].classList.add("best");
      });
      cells[i][j].classList.add("cur");
      rowHdr[i].classList.add("hl"); colHdr[j].classList.add("hl");
      explainFill(i, j);
    } else if (ph !== "fill") {
      for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) cells[i][j].classList.add("dim");
      for (let k = 0; k < tk; k++) {
        const mv = moves[k];
        const c = cells[mv.i][mv.j];
        c.classList.remove("dim"); c.classList.add("path");
        const ar = document.createElement("span");
        ar.className = "arrow " + mv.type; ar.textContent = ARROW[mv.type];
        c.appendChild(ar);
      }
      // the cell the traceback has reached
      let ci = m, cj = n;
      if (tk > 0) {
        const last = moves[tk - 1];
        ci = last.type === "ins" ? last.i : last.i - 1;
        cj = last.type === "del" ? last.j : last.j - 1;
      }
      cells[ci][cj].classList.remove("dim"); cells[ci][cj].classList.add("path");
      if (ph === "trace") {
        const mv = moves[tk - 1];
        cells[mv.i][mv.j].classList.add("cur");
        if (mv.type !== "ins") rowHdr[mv.i].classList.add("hl");
        if (mv.type !== "del") colHdr[mv.j].classList.add("hl");
        explainTrace(mv, tk);
      } else {
        explainDone();
      }
    } else {
      explainStart();
    }

    const order = ["fill", "trace", "done"];
    document.querySelectorAll(".phase").forEach((p) => {
      p.classList.toggle("on", p.dataset.p === ph);
      p.classList.toggle("done", order.indexOf(p.dataset.p) < order.indexOf(ph));
    });
    $("scrub").value = step;
    $("stepcount").textContent = `${step} / ${total}`;
    renderAlignment(ph, tk);
  }

  // ---- explanation panel ----
  const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const pre = (str, k) => (k === 0 ? "ε" : esc(str.slice(0, k)));

  function explainStart() {
    $("explain").innerHTML = `
      <h2>Step 0 · Base cases</h2>
      <p class="lead">Row 0 and column 0 are filled before the loop starts.</p>
      <p>Turning an empty string into the first <span class="mono">j</span> letters of <span class="mono">t</span> takes <span class="mono">j</span> insertions, so <span class="mono">dp[0][j] = j</span>. Turning the first <span class="mono">i</span> letters of <span class="mono">s</span> into an empty string takes <span class="mono">i</span> deletions, so <span class="mono">dp[i][0] = i</span>.</p>
      <p>Press <b>Step</b> or <b>Play</b> to fill the table, ${m * n} cells in total.</p>`;
  }

  function cand(label, tag, formula, res, win, na) {
    return `<div class="cand${win ? " win" : ""}${na ? " na" : ""}">
      <span class="k">${label}</span>${tag}<span class="r">${res}</span>
      <span class="f">${formula}</span></div>`;
  }

  function explainFill(i, j) {
    const a = S[i - 1], b = T[j - 1], cost = a === b ? 0 : 1, v = dp[i][j];
    const up = dp[i - 1][j] + 1, left = dp[i][j - 1] + 1, diag = dp[i - 1][j - 1] + cost;
    const dTag = cost ? `<span class="tag sub">sub</span>` : `<span class="tag match">match</span>`;
    const ties = [up, left, diag].filter((x) => x === v).length > 1;
    $("explain").innerHTML = `
      <h2>Filling dp[${i}][${j}] = ${v}</h2>
      <p>This is the edit distance between <span class="mono">${pre(S, i)}</span> and <span class="mono">${pre(T, j)}</span>.</p>
      ${cand("↑ Up", `<span class="tag del">del</span>`, `dp[${i - 1}][${j}] + 1 = ${dp[i - 1][j]} + 1 · delete '${esc(a)}'`, up, up === v)}
      ${cand("← Left", `<span class="tag ins">ins</span>`, `dp[${i}][${j - 1}] + 1 = ${dp[i][j - 1]} + 1 · insert '${esc(b)}'`, left, left === v)}
      ${cand("↖ Diagonal", dTag, `dp[${i - 1}][${j - 1}] + ${cost} = ${dp[i - 1][j - 1]} + ${cost} · '${esc(a)}' vs '${esc(b)}'${cost ? " differ" : " are equal"}`, diag, diag === v)}
      <p>The smallest is <b class="mono">${v}</b>, so that goes in the cell.${ties ? " More than one option ties here, which is why there can be several optimal alignments." : ""}</p>`;
  }

  function explainTrace(mv, tk) {
    const { i, j, v } = mv;
    const leftOk = mv.type === "ins";
    const diagOk = mv.type === "match" || mv.type === "sub";
    const check = (val, ok, skipped) => (val === null ? "n/a" : skipped ? "skipped" : ok ? `${val} ✓` : `${val} ✗`);
    const col = mv.type === "ins" ? `'-' over '${esc(mv.b)}'` : mv.type === "del" ? `'${esc(mv.a)}' over '-'` : `'${esc(mv.a)}' over '${esc(mv.b)}'`;
    $("explain").innerHTML = `
      <h2>Traceback ${tk} of ${moves.length} · at dp[${i}][${j}] = ${v}</h2>
      <p>Find a neighbouring cell that could have produced ${v}. The code checks the moves in this order:</p>
      ${cand("1 · Left", `<span class="tag ins">ins</span>`, mv.left === null ? "j = 0, can't move left" : `dp[${i}][${j - 1}] + 1 = ${mv.left}`, check(mv.left, leftOk, false), leftOk, mv.left === null)}
      ${cand("2 · Diagonal", mv.cost ? `<span class="tag sub">sub</span>` : `<span class="tag match">match</span>`, mv.diag === null ? "i or j is 0, can't move diagonally" : `dp[${i - 1}][${j - 1}] + ${mv.cost} = ${mv.diag}`, check(mv.diag, diagOk, leftOk), diagOk, mv.diag === null || leftOk)}
      ${cand("3 · Up", `<span class="tag del">del</span>`, mv.up === null ? "i = 0, can't move up" : `the else branch: dp[${i - 1}][${j}] + 1 = ${mv.up}`, mv.type === "del" ? `${mv.up} ✓` : "skipped", mv.type === "del", mv.type !== "del")}
      <p><span class="tag ${mv.type}">${OPS[mv.type]}</span> adds the column ${col} to the <b>front</b> of the alignment. That's why the Python code reverses the lists at the end.</p>`;
  }

  function explainDone() {
    const counts = countOps(moves.length);
    $("explain").innerHTML = `
      <h2>Done · edit distance ${result.distance}</h2>
      <p class="lead">The traceback reached <span class="mono">dp[0][0]</span>.</p>
      <p>The highlighted path is one optimal alignment. Counting the columns where the two rows differ gives ${counts.sub} substitution(s) + ${counts.ins} insertion(s) + ${counts.del} deletion(s) = <b class="mono">${result.distance}</b>, the same number as <span class="mono">dp[${m}][${n}]</span>.</p>
      <p>Program output (from the Python backend):</p>
      <div class="formula"><b>${result.distance}
${esc(result.aligned_s)}
${esc(result.aligned_t)}</b></div>`;
  }

  // ---- alignment readout ----
  function countOps(k) {
    const counts = { match: 0, sub: 0, ins: 0, del: 0 };
    moves.slice(0, k).forEach((mv) => counts[mv.type]++);
    return counts;
  }

  function renderAlignment(ph, tk) {
    const box = $("alignment");
    if (ph === "fill") {
      box.innerHTML = `<p class="placeholder">The alignment is built during the traceback, from right to left. Finish filling the table or press <b>Skip to traceback</b>.</p>`;
      return;
    }
    const L = moves.length;
    let cols = "";
    for (let c = 0; c < L; c++) {
      const k = L - 1 - c; // the move that produced this column
      const mv = moves[k];
      const shown = k < tk;
      const cls = shown ? mv.type : "pending";
      const newest = shown && k === tk - 1 && ph === "trace" ? " newest" : "";
      cols += `<div class="col">
        <div class="ac ${cls}${mv.a === "-" && shown ? " gap" : ""}${newest}">${shown ? esc(mv.a) : "·"}</div>
        <div class="ac ${cls}${mv.b === "-" && shown ? " gap" : ""}${newest}">${shown ? esc(mv.b) : "·"}</div>
        <div class="ac op ${cls}">${shown ? { match: "=", sub: "sub", ins: "ins", del: "del" }[mv.type] : ""}</div>
      </div>`;
    }
    const counts = countOps(tk);
    const cost = counts.sub + counts.ins + counts.del;
    box.innerHTML = `
      <div class="alignbox"><div class="alnrow">
        <div class="alnlabels"><span>s′</span><span>t′</span><span></span></div>
        <div class="aln">${cols}</div>
      </div></div>
      <div class="counts">
        <span>Matches <b>${counts.match}</b></span>
        <span>Substitutions <b>${counts.sub}</b></span>
        <span>Insertions <b>${counts.ins}</b></span>
        <span>Deletions <b>${counts.del}</b></span>
        <span>Cost so far <b>${cost}</b>${ph === "done" ? " = d<sub>E</sub>(s, t)" : ` of ${result.distance}`}</span>
      </div>`;
  }

  // ---- controls ----
  function go(k) { step = Math.max(0, Math.min(total, k)); render(); }
  function delay() { return 1100 / Number($("speed").value) ** 1.15; }
  function stop() { clearTimeout(timer); timer = null; $("bPlay").textContent = "▶ Play"; }
  function tick() {
    if (step >= total) { stop(); return; }
    go(step + 1);
    timer = setTimeout(tick, delay());
  }
  function togglePlay() {
    if (!result) return;
    if (timer) { stop(); return; }
    if (step >= total) go(0);
    $("bPlay").textContent = "❚❚ Pause";
    timer = setTimeout(tick, 60);
  }

  $("bPlay").addEventListener("click", togglePlay);
  $("bNext").addEventListener("click", () => { stop(); go(step + 1); });
  $("bPrev").addEventListener("click", () => { stop(); go(step - 1); });
  $("bStart").addEventListener("click", () => { stop(); go(0); });
  $("bEnd").addEventListener("click", () => { stop(); go(total); });
  $("bTrace").addEventListener("click", () => { stop(); go(m * n + 1); });
  $("scrub").addEventListener("input", (e) => { stop(); go(Number(e.target.value)); });

  $("grid").addEventListener("click", (e) => {
    const c = e.target.closest(".cell.v");
    if (!c) return;
    const i = Number(c.dataset.i), j = Number(c.dataset.j);
    stop();
    go(i === 0 || j === 0 ? 0 : fillIndex(i, j) + 1);
  });
  $("grid").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".cell.v")) {
      e.preventDefault(); e.stopPropagation(); e.target.click();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input[type=text], select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(step - 1); }
    else if (e.key === " " && !e.target.matches("button")) { e.preventDefault(); togglePlay(); }
    else if (e.key === "Home") { stop(); go(0); }
    else if (e.key === "End") { stop(); go(total); }
  });

  const clean = (v) => v.toUpperCase().replace(/[^A-Z]/g, "");
  $("seqS").addEventListener("input", (e) => { e.target.value = clean(e.target.value); });
  $("seqT").addEventListener("input", (e) => { e.target.value = clean(e.target.value); });
  $("preset").addEventListener("change", (e) => {
    const [a, b] = e.target.value.split("|");
    load(a, b);
  });
  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    load($("seqS").value, $("seqT").value);
  });

  load("PRETTY", "PRTTEIN");
})();
