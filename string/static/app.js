// Frontend for the REVP visualizer.
// The list of windows comes from the Python backend (POST /api/revp);
// this file only draws them and steps through them.
(function () {
  const $ = (id) => document.getElementById(id);
  const COMP = { A: "T", T: "A", C: "G", G: "C" };

  let data = null, dna = "", n = 0, trace = [], hits = [], total = 0, step = 0, timer = null;

  // ---- backend ----
  async function load(dataset) {
    stop();
    let res, body;
    try {
      res = await fetch("/api/revp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset }),
      });
      body = await res.json();
      if (!res.ok) throw new Error(body.error || `The server returned ${res.status}.`);
    } catch (err) {
      showError(err instanceof TypeError
        ? "Can't reach the Python server. Start it with: python server.py, then open http://localhost:8002"
        : err.message);
      return;
    }
    showError("");
    data = body; dna = body.dna; n = dna.length; trace = body.trace;
    total = trace.length + 1; // one extra step for the summary
    hits = assignTracks();
    step = 0;
    $("scrub").max = total;
    render();
  }

  function showError(msg) {
    $("err").textContent = msg;
    $("err").hidden = !msg;
  }

  // Stack the hit bars so overlapping sites go on separate rows
  function assignTracks() {
    const ends = [];
    const out = [];
    trace.forEach((t, k) => {
      if (!t.hit) return;
      const start = t.i, end = t.i + t.length - 1;
      let row = ends.findIndex((e) => e < start);
      if (row === -1) { row = ends.length; ends.push(end); } else ends[row] = end;
      out.push({ k, i: t.i, length: t.length, row });
    });
    return out;
  }

  // ---- drawing ----
  function render() {
    if (!data) return;
    const done = step === total;
    const cur = step > 0 && !done ? trace[step - 1] : null;

    // DNA strip
    const s = $("strip");
    const extra = cur && cur.brk ? cur.i + cur.length - n : 0; // ghost cells past the end
    s.style.gridTemplateColumns = `repeat(${n + extra}, var(--b))`;
    let html = "";
    for (let j = 0; j < n + extra; j++) html += `<div class="pos">${j + 1}</div>`;
    for (let j = 0; j < n; j++) {
      let cls = "base " + dna[j];
      if (cur && j >= cur.i && j < cur.i + cur.length) cls += cur.brk ? " win over" : " win" + (cur.hit ? " hit" : " miss");
      html += `<div class="${cls}" data-j="${j}" role="button" tabindex="0" aria-label="position ${j + 1}">${dna[j]}</div>`;
    }
    for (let j = 0; j < extra; j++) html += `<div class="base ghost">?</div>`;
    s.innerHTML = html;
    $("where").textContent = cur
      ? `i = ${cur.i} (position ${cur.i + 1}), length ${cur.length}`
      : `${n} bases`;

    // hit tracks
    const shown = hits.filter((h) => h.k < step);
    const rows = Math.max(0, ...shown.map((h) => h.row + 1));
    const tr = $("tracks");
    if (!shown.length) {
      tr.innerHTML = `<span class="notracks">${step === 0 ? "None yet." : "None found so far."}</span>`;
    } else {
      let t = "";
      for (let r = 0; r < rows; r++) {
        t += `<div class="trackrow" style="grid-template-columns: repeat(${n}, var(--b))">`;
        shown.filter((h) => h.row === r).forEach((h) => {
          const newest = cur && h.k === step - 1 ? " newest" : "";
          t += `<div class="bar${newest}" style="grid-column: ${h.i + 1} / span ${h.length}" title="position ${h.i + 1}, length ${h.length}">${h.i + 1} ${h.length}</div>`;
        });
        t += `</div>`;
      }
      tr.innerHTML = t;
    }

    renderCompare(cur);
    if (done) explainDone();
    else if (!cur) explainStart();
    else if (cur.brk) explainBreak(cur);
    else explainWindow(cur);

    $("scrub").value = step;
    $("stepcount").textContent = `${step} / ${total}`;
    renderOutput(cur);
  }

  function renderCompare(cur) {
    const box = $("compare");
    if (!cur || cur.brk) {
      box.innerHTML = `<p class="cmpnote">${cur ? "No window: it would run past the end of the DNA." : "Step forward to see a window."}</p>`;
      return;
    }
    const L = cur.length;
    let h = `<div class="cmp" style="grid-template-columns: auto repeat(${L}, var(--b))">`;
    h += `<div class="lbl">sub</div>`;
    for (let k = 0; k < L; k++) h += `<div class="base ${cur.sub[k]} ${cur.sub[k] === cur.rc[k] ? "eq" : "neq"}">${cur.sub[k]}</div>`;
    h += `<div class="lbl">reverse complement</div>`;
    for (let k = 0; k < L; k++) h += `<div class="base ${cur.rc[k]} ${cur.sub[k] === cur.rc[k] ? "eq" : "neq"}">${cur.rc[k]}</div>`;
    h += `<div class="lbl"></div>`;
    for (let k = 0; k < L; k++) h += `<div class="mark ${cur.sub[k] === cur.rc[k] ? "ok" : "bad"}">${cur.sub[k] === cur.rc[k] ? "✓" : "✗"}</div>`;
    box.innerHTML = h + `</div>`;
  }

  function explainStart() {
    const windows = trace.filter((t) => !t.brk).length;
    $("explain").innerHTML = `
      <h2>Step 0 · Start</h2>
      <p class="lead">The DNA has ${n} bases, and <span class="mono">results</span> starts empty.</p>
      <p>The outer loop tries every start index <span class="mono">i</span>. For each one, the inner loop tries lengths 4 to 12. That's ${windows} windows in total for this sequence.</p>
      <p>Press <b>Step</b> or <b>Play</b> to check them one by one, or <b>Next site</b> to jump straight to the next palindrome.</p>`;
  }

  function explainWindow(t) {
    const rev = t.sub.split("").reverse().join("");
    const firstBad = [...t.sub].findIndex((c, k) => c !== t.rc[k]);
    const verdict = t.hit
      ? `<p><span class="tag match">palindrome</span> The two strings are equal, so <span class="mono">(${t.i + 1}, ${t.length})</span> is added to <span class="mono">results</span>. Position ${t.i + 1} is 1-based, because the code adds 1 to <span class="mono">i</span>.</p>`
      : `<p><span class="tag del">not equal</span> Column ${firstBad}: <span class="mono">sub</span> has ${t.sub[firstBad]}, but the reverse complement has ${t.rc[firstBad]}. That base would need to pair with ${t.sub[t.length - 1 - firstBad]} at the other end of the window, but ${t.sub[firstBad]} and ${t.sub[t.length - 1 - firstBad]} are not complements.</p>`;
    $("explain").innerHTML = `
      <h2>Window dna[${t.i}:${t.i + t.length}]</h2>
      <div class="cand${t.hit ? " win" : ""}"><span class="k">sub</span><span></span><span class="r">${t.sub}</span>
        <span class="f">reversed → ${rev}<br>complemented → ${t.rc}</span></div>
      ${verdict}`;
  }

  function explainBreak(t) {
    $("explain").innerHTML = `
      <h2>i = ${t.i}, length ${t.length} · break</h2>
      <p class="lead"><span class="mono">i + length = ${t.i + t.length} &gt; n = ${n}</span></p>
      <p>This window would run past the end of the DNA (the dashed cells). Every longer length would too, so the code <span class="mono">break</span>s out of the inner loop and moves on to the next <span class="mono">i</span>.</p>`;
  }

  function explainDone() {
    const windows = trace.filter((t) => !t.brk).length;
    $("explain").innerHTML = `
      <h2>Done · ${data.results.length} site${data.results.length === 1 ? "" : "s"}</h2>
      <p class="lead">The code checked ${windows} windows and found ${data.results.length} reverse palindrome${data.results.length === 1 ? "" : "s"}.</p>
      <p>Each one is printed as <span class="mono">position length</span>, sorted by position and then by length, because that's the order the loops visit them.</p>
      <p>The lengths are capped at 12, so each start position needs at most 9 checks of up to 12 bases. That makes the run <b>O(n)</b> for this problem.</p>`;
  }

  function renderOutput(cur) {
    const shown = hits.filter((h) => h.k < step);
    $("outcount").textContent = step === total ? `· ${data.results.length} lines, same as revp.py` : `· ${shown.length} so far`;
    $("output").innerHTML = shown.length
      ? `<div class="outlist">${shown.map((h) => `<span class="outline${cur && h.k === step - 1 ? " newest" : ""}">${h.i + 1} ${h.length}</span>`).join("")}</div>`
      : `<p class="placeholder">Each palindrome found is printed here as <span class="mono">position length</span>.</p>`;
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
    if (!data) return;
    if (timer) { stop(); return; }
    if (step >= total) go(0);
    $("bPlay").textContent = "❚❚ Pause";
    timer = setTimeout(tick, 60);
  }
  function nextHit() {
    stop();
    const next = hits.find((h) => h.k + 1 > step);
    go(next ? next.k + 1 : total);
  }

  $("bPlay").addEventListener("click", togglePlay);
  $("bNext").addEventListener("click", () => { stop(); go(step + 1); });
  $("bPrev").addEventListener("click", () => { stop(); go(step - 1); });
  $("bStart").addEventListener("click", () => { stop(); go(0); });
  $("bEnd").addEventListener("click", () => { stop(); go(total); });
  $("bHit").addEventListener("click", nextHit);
  $("scrub").addEventListener("input", (e) => { stop(); go(Number(e.target.value)); });

  $("strip").addEventListener("click", (e) => {
    const c = e.target.closest(".base[data-j]");
    if (!c) return;
    const j = Number(c.dataset.j);
    stop();
    go(trace.findIndex((t) => t.i === j) + 1);
  });
  $("strip").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".base[data-j]")) {
      e.preventDefault(); e.stopPropagation(); e.target.click();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("textarea, select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(step - 1); }
    else if (e.key === " " && !e.target.matches("button")) { e.preventDefault(); togglePlay(); }
    else if (e.key === "n" || e.key === "N") nextHit();
    else if (e.key === "Home") { stop(); go(0); }
    else if (e.key === "End") { stop(); go(total); }
  });

  $("preset").addEventListener("change", (e) => {
    $("dataset").value = e.target.value;
    load(e.target.value);
  });
  $("random").addEventListener("click", () => {
    const size = 20 + Math.floor(Math.random() * 16);
    // plant one known site so a random sequence always shows at least one hit
    const site = ["GAATTC", "AAGCTT", "GGATCC", "GCATGC", "TATA"][Math.floor(Math.random() * 5)];
    let seq = Array.from({ length: size - site.length }, () => "ACGT"[Math.floor(Math.random() * 4)]).join("");
    const at = Math.floor(Math.random() * (seq.length + 1));
    seq = seq.slice(0, at) + site + seq.slice(at);
    $("dataset").value = `>random\n${seq}`;
    load($("dataset").value);
  });
  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    load($("dataset").value);
  });

  load($("dataset").value);
})();
