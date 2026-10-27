// Frontend for the LGIS visualizer.
// The step-by-step trace comes from the Python backend (POST /api/lgis);
// this file only draws it and steps through it.
(function () {
  const $ = (id) => document.getElementById(id);

  let data = null, mode = "increasing";
  let arr = [], steps = [], chain = [], n = 0, total = 0, step = 0, timer = null;

  // ---- backend ----
  async function load(dataset) {
    stop();
    let res, body;
    try {
      res = await fetch("/api/lgis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset }),
      });
      body = await res.json();
      if (!res.ok) throw new Error(body.error || `The server returned ${res.status}.`);
    } catch (err) {
      showError(err instanceof TypeError
        ? "Can't reach the Python server. Start it with: python server.py, then open http://localhost:8001"
        : err.message);
      return;
    }
    showError("");
    data = body;
    setMode(mode);
  }

  function showError(msg) {
    $("err").textContent = msg;
    $("err").hidden = !msg;
  }

  function setMode(m) {
    stop();
    mode = m;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.mode === m;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", String(on));
    });
    if (!data) return;
    const tr = data[mode];
    arr = tr.array; steps = tr.steps; chain = tr.chain; n = arr.length;
    total = n + chain.length;
    step = 0;
    $("scrub").max = total;
    $("resultTitle").textContent = mode === "increasing" ? "Longest increasing subsequence" : "Longest decreasing subsequence";
    render();
  }

  // ---- drawing ----
  const fmt = (list) => "[" + list.join(", ") + "]";
  const dec = () => mode === "decreasing";

  function render() {
    if (!data) return;
    const ph = step === total ? "done" : step <= n ? "fill" : "trace";
    const scanned = Math.min(step, n);
    const cur = ph === "fill" && step > 0 ? step - 1 : -1;
    const st = cur >= 0 ? steps[cur] : null;
    const r = Math.max(0, step - n); // parent-walk steps revealed
    const chainSet = new Set(chain.slice(0, r));
    const walkAt = ph === "trace" ? chain[r - 1] : -1;

    // sequence rows
    const g = $("seq");
    g.style.gridTemplateColumns = `auto repeat(${n}, var(--cell))`;
    let html = `<div class="cell lbl idx">i</div>`;
    for (let i = 0; i < n; i++) html += `<div class="cell idx">${i}</div>`;
    if (dec()) {
      html += `<div class="cell lbl small">x</div>`;
      for (let i = 0; i < n; i++) html += `<div class="cell small">${data.perm[i]}</div>`;
    }
    html += `<div class="cell lbl">${dec() ? "−x (used)" : "x"}</div>`;
    for (let i = 0; i < n; i++) {
      let cls = "cell num";
      if (i >= scanned) cls += " todo";
      if (st && st.parent === i) cls += " par";
      if (chainSet.has(i)) cls += " chain";
      if (i === cur || i === walkAt) cls += " cur";
      html += `<div class="${cls}" data-i="${i}" role="button" tabindex="0" aria-label="element ${i}">${arr[i]}</div>`;
    }
    html += `<div class="cell lbl small">dp[i] = pos+1</div>`;
    for (let i = 0; i < n; i++)
      html += `<div class="cell small lenv${i === cur ? " hl" : ""}">${i < scanned ? steps[i].pos + 1 : ""}</div>`;
    html += `<div class="cell lbl small">parent</div>`;
    for (let i = 0; i < n; i++) {
      const p = i < scanned ? steps[i].parent : null;
      html += `<div class="cell small">${p === null ? "" : p < 0 ? "–" : "i=" + p}</div>`;
    }
    g.innerHTML = html;

    // tails row
    const tb = $("tails");
    if (scanned === 0) {
      tb.innerHTML = `<span class="emptytails">tails = [ ]</span>`;
    } else {
      const s = steps[scanned - 1];
      tb.innerHTML = s.tails.map((v, k) => {
        let cls = "cell";
        if (st && k === st.pos) cls += " cur";
        if (ph !== "fill" && k === s.tails.length - 1) cls += " last";
        const old = st && k === st.pos && st.replaced !== null ? st.replaced : "";
        return `<div class="slot"><span class="old">${old}</span><div class="${cls}">${v}</div>
          <small>len ${k + 1}</small><small>@i=${s.tails_idx[k]}</small></div>`;
      }).join("");
    }

    if (ph === "fill") (st ? explainScan(st) : explainStart());
    else if (ph === "trace") explainWalk(r);
    else explainDone();

    const order = ["fill", "trace", "done"];
    document.querySelectorAll(".phase").forEach((p) => {
      p.classList.toggle("on", p.dataset.p === ph);
      p.classList.toggle("done", order.indexOf(p.dataset.p) < order.indexOf(ph));
    });
    $("scrub").value = step;
    $("stepcount").textContent = `${step} / ${total}`;
    renderResult(ph, r);
  }

  function explainStart() {
    $("explain").innerHTML = `
      <h2>Step 0 · Start</h2>
      <p class="lead"><span class="mono">tails</span> starts empty.</p>
      ${dec() ? `<p>For the decreasing subsequence, <span class="mono">solve()</span> negates every number and finds the longest <b>increasing</b> subsequence of <span class="mono">−x</span>. At the end it negates the answer back.</p>` : ""}
      <p><span class="mono">tails[k]</span> will hold the smallest value that an increasing subsequence of length <span class="mono">k+1</span> can end with. Because it's always sorted, the code can binary search it.</p>
      <p>Press <b>Step</b> or <b>Play</b> to process the ${n} numbers.</p>`;
  }

  function explainScan(st) {
    const { i, x, pos } = st;
    const before = i > 0 ? steps[i - 1].tails : [];
    let why;
    if (before.length === 0) why = "tails is empty";
    else if (pos === before.length) why = `every value in tails is smaller than ${x}`;
    else if (pos === 0) why = `tails[0] = ${before[0]} ≥ ${x}`;
    else why = `tails[${pos - 1}] = ${before[pos - 1]} < ${x} ≤ tails[${pos}] = ${before[pos]}`;

    const action = st.replaced === null
      ? `<p><span class="tag match">append</span> ${x} makes the longest subsequence so far one longer. <span class="mono">tails</span> now has length ${st.tails.length}.</p>`
      : `<p><span class="tag sub">replace</span> <span class="mono">tails[${pos}]</span> was ${st.replaced} (from i=${st.replaced_idx}). Now an increasing subsequence of length ${pos + 1} can end with the smaller value ${x}, which leaves more room for the numbers after it.</p>`;
    const par = pos > 0
      ? `<span class="mono">parent[${i}] = tails_idx[${pos - 1}] = ${st.parent}</span>, so ${x} comes after ${arr[st.parent]} (the dashed cell).`
      : `<span class="mono">parent[${i}] = -1</span>, so ${x} starts a new subsequence.`;

    $("explain").innerHTML = `
      <h2>i = ${i} · x = ${x}</h2>
      <div class="cand win"><span class="k">pos</span><span></span><span class="r">${pos}</span>
        <span class="f">bisect_left(${fmt(before)}, ${x}) → ${why}</span></div>
      ${action}
      <p>${par}</p>
      <p>The longest increasing subsequence ending at ${x} has length <b class="mono">dp[${i}] = pos + 1 = ${pos + 1}</b>.</p>`;
  }

  function explainWalk(r) {
    const k = chain[r - 1];
    const final = steps[n - 1];
    const first = r === 1
      ? `<p class="lead">Start at <span class="mono">tails_idx[-1] = ${k}</span>, the last element of a longest subsequence (length ${final.tails.length}).</p>`
      : `<p class="lead">Follow <span class="mono">parent[${chain[r - 2]}] = ${k}</span>.</p>`;
    const sameAsTails = final.tails.join() === chain.map((c) => arr[c]).reverse().join();
    $("explain").innerHTML = `
      <h2>Rebuild · step ${r} of ${chain.length}</h2>
      ${first}
      <p>Add ${arr[k]} to <span class="mono">result</span>. Next is <span class="mono">parent[${k}] = ${steps[k].parent}</span>${steps[k].parent < 0 ? ", so the loop will stop." : "."}</p>
      <p>The values come out from last to first, so <span class="mono">liss.py</span> calls <span class="mono">result.reverse()</span> at the end.</p>
      ${sameAsTails ? "" : `<p>The final <span class="mono">tails</span> array ${fmt(final.tails)} is <b>not</b> the answer. Only its length and its last index are used. The answer comes from the parent links.</p>`}`;
  }

  function explainDone() {
    const res = data[mode].result;
    const shown = dec() ? res.map((v) => -v) : res;
    $("explain").innerHTML = `
      <h2>Done · length ${res.length}</h2>
      <p class="lead">The walk reached <span class="mono">parent = -1</span>.</p>
      ${dec() ? `<p>The longest increasing subsequence of <span class="mono">−x</span> is ${fmt(res)}. Negating it back gives the longest <b>decreasing</b> subsequence ${fmt(shown)}.</p>` : `<p>The longest increasing subsequence is ${fmt(shown)}.</p>`}
      <p>The whole run took ${n} binary searches of O(log n) each, so it is <b>O(n log n)</b>.</p>`;
  }

  function renderResult(ph, r) {
    const L = chain.length;
    const ordered = chain.slice().reverse(); // indices in output order
    const revealed = (pos) => ph !== "fill" && L - 1 - pos < r; // revealed from the right
    const row = (label, f) => `<div class="outrow"><span class="lab">${label}</span>${ordered.map((k, pos) =>
      `<span class="pill${revealed(pos) ? "" : " pending"}">${revealed(pos) ? f(k) : "·"}</span>`).join("")}</div>`;
    const out = data.output;
    $("result").innerHTML = `<div class="out">
      ${row(dec() ? "result (−x)" : "result", (k) => arr[k])}
      ${dec() ? row("negated back", (k) => -arr[k]) : ""}
      <div class="formula"><b>liss.py output
${out.increasing.join(" ")}
${out.decreasing.join(" ")}</b></div>
    </div>`;
  }

  // ---- controls ----
  function go(k) { step = Math.max(0, Math.min(total, k)); render(); }
  function delay() { return 1400 / Number($("speed").value) ** 1.15; }
  function stop() { clearTimeout(timer); timer = null; $("bPlay").textContent = "▶ Play"; }
  function tick() {
    if (step >= total) { stop(); return; }
    go(step + 1);
    timer = setTimeout(tick, delay());
  }
  function togglePlay() {
    if (!data) return;
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
  $("bTrace").addEventListener("click", () => { stop(); go(n + 1); });
  $("scrub").addEventListener("input", (e) => { stop(); go(Number(e.target.value)); });

  $("seq").addEventListener("click", (e) => {
    const c = e.target.closest(".cell.num");
    if (!c) return;
    stop();
    go(Number(c.dataset.i) + 1);
  });
  $("seq").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".cell.num")) {
      e.preventDefault(); e.stopPropagation(); e.target.click();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("textarea, select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(step - 1); }
    else if (e.key === " " && !e.target.matches("button")) { e.preventDefault(); togglePlay(); }
    else if (e.key === "Home") { stop(); go(0); }
    else if (e.key === "End") { stop(); go(total); }
  });

  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
  $("preset").addEventListener("change", (e) => {
    $("dataset").value = e.target.value;
    load(e.target.value);
  });
  $("random").addEventListener("click", () => {
    const size = 8 + Math.floor(Math.random() * 7);
    const p = Array.from({ length: size }, (_, k) => k + 1);
    for (let k = size - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [p[k], p[j]] = [p[j], p[k]];
    }
    $("dataset").value = `${size}\n${p.join(" ")}`;
    load($("dataset").value);
  });
  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    load($("dataset").value);
  });

  load($("dataset").value);
})();
