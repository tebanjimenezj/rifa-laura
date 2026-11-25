(() => {
  const C = window.RIFA;
  const $ = (s) => document.querySelector(s);
  const KEY = "rifa-admin-key";
  const DEMO = new URLSearchParams(location.search).has("demo");
  const TAU = Math.PI * 2;
  const COLORES = ["#b5462e", "#5b2a43", "#d7a03f", "#f3e6d6"];
  const TEXTO = ["#fff", "#fff", "#2a1d18", "#2a1d18"];

  let clave = "";
  try { clave = sessionStorage.getItem(KEY) || ""; } catch {}
  let entradas = [];      // [{ numero, nombre, celular }]
  let rot = 0;            // rotación actual de la ruleta (radianes)
  let girando = false;
  let ganador = null;
  let sonido = true;

  $("#h-titulo").textContent = C.titulo;
  $("#h-premio").textContent = `${C.premio} · valorizado en $${C.valorPremio.toLocaleString("es-CO")}`;

  let tt;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(tt);
    tt = setTimeout(() => t.classList.remove("show"), 2600);
  }

  const ocultarCel = (c) => (c ? `${c.slice(0, 3)} *** ${c.slice(6)}` : "");

  async function api(method, body) {
    const r = await fetch("/api/admin", {
      method,
      headers: { "content-type": "application/json", "x-admin-key": clave },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Error del servidor");
    return d;
  }

  async function cargar() {
    if (DEMO) {
      const nombres = ["Ana María Restrepo", "Carlos Andrés Mejía", "Luisa Fernanda Ríos", "Jorge Iván Castaño", "Valentina Ospina", "Andrés Felipe Gil", "Paula Andrea Vélez", "Santiago Arango", "Daniela Cárdenas", "Juan Pablo Henao"];
      const usados = new Set();
      while (usados.size < 140) usados.add(1 + Math.floor(Math.random() * 500));
      entradas = [...usados].sort((a, b) => a - b).map((n, i) => ({
        numero: String(n).padStart(3, "0"), nombre: nombres[i % nombres.length], celular: "3001234567",
      }));
    } else {
      const d = await api("GET");
      entradas = d.reservas
        .filter((r) => r.estado === "pagado")
        .flatMap((r) => r.numeros.map((n) => ({ numero: n, nombre: r.nombre, celular: r.celular })))
        .sort((a, b) => a.numero.localeCompare(b.numero));
    }
    $("#meta").textContent = entradas.length
      ? `Participan ${entradas.length} números pagados${DEMO ? " (datos de ejemplo)" : ""}`
      : "Aún no hay números pagados. Márcalos como pagados en el panel.";
    $("#spin").disabled = entradas.length === 0;
    dibujar();
    actualizarTicker(true);
  }

  // ── Dibujo de la ruleta ──
  const cv = $("#wheel");
  const ctx = cv.getContext("2d");

  function dibujar() {
    const S = cv.width, R = S / 2, cx = R, cy = R;
    ctx.clearRect(0, 0, S, S);
    const n = entradas.length;

    // Aro exterior
    ctx.beginPath(); ctx.arc(cx, cy, R - 4, 0, TAU); ctx.fillStyle = "#2a1d18"; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = "#d7a03f"; ctx.stroke();

    const rIn = R - 26;
    if (!n) {
      ctx.beginPath(); ctx.arc(cx, cy, rIn, 0, TAU); ctx.fillStyle = "#3a2a24"; ctx.fill();
    } else {
      const a = TAU / n;
      const conTexto = n <= 160;
      const fs = Math.max(14, Math.min(46, a * rIn * 0.62));
      for (let i = 0; i < n; i++) {
        const ini = rot + i * a - Math.PI / 2;
        const ci = n % 4 === 1 && i === n - 1 ? 1 : i % 4; // evita dos colores iguales juntos
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rIn, ini, ini + a); ctx.closePath();
        ctx.fillStyle = COLORES[ci]; ctx.fill();
        if (n <= 300) { ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1.5; ctx.stroke(); }
        if (conTexto) {
          ctx.save();
          ctx.translate(cx, cy); ctx.rotate(ini + a / 2);
          ctx.fillStyle = TEXTO[ci];
          ctx.font = `700 ${fs}px "DM Sans", sans-serif`;
          ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(entradas[i].numero, rIn - 18, 0);
          ctx.restore();
        }
      }
    }

    // Luces del aro
    const luces = 36;
    for (let i = 0; i < luces; i++) {
      const ang = (i / luces) * TAU;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * (R - 15), cy + Math.sin(ang) * (R - 15), 5, 0, TAU);
      ctx.fillStyle = i % 2 ? "#fff3d6" : "#d7a03f"; ctx.fill();
    }

    // Centro
    const rc = R * 0.17;
    ctx.beginPath(); ctx.arc(cx, cy, rc, 0, TAU);
    ctx.fillStyle = "#fffdf9"; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = "#d7a03f"; ctx.stroke();
    ctx.fillStyle = "#5b2a43";
    ctx.font = `700 ${rc * 0.42}px "Fraunces", serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("RIFA", cx, cy);
  }

  function indiceBajoPuntero() {
    const n = entradas.length;
    if (!n) return -1;
    const local = (((-rot) % TAU) + TAU) % TAU;
    return Math.floor(local / (TAU / n)) % n;
  }

  let ultimo = -1;
  function actualizarTicker(forzar) {
    const i = indiceBajoPuntero();
    if (i === ultimo && !forzar) return;
    ultimo = i;
    if (i < 0) { $("#t-num").textContent = "—"; $("#t-name").textContent = ""; return; }
    $("#t-num").textContent = entradas[i].numero;
    $("#t-name").textContent = entradas[i].nombre;
    if (girando) clic();
  }

  // ── Sonido ──
  let actx;
  function clic() {
    if (!sonido) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "triangle"; o.frequency.value = 1400;
      g.gain.setValueAtTime(0.08, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.04);
      o.connect(g).connect(actx.destination);
      o.start(); o.stop(actx.currentTime + 0.05);
    } catch {}
  }

  // Aleatorio criptográficamente seguro y sin sesgo: entero en [0, n)
  function azar(n) {
    const lim = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= lim);
    return buf[0] % n;
  }

  function girar() {
    const n = entradas.length;
    if (!n || girando) return;
    girando = true;
    $("#spin").disabled = true;
    $("#reload").disabled = true;

    const w = azar(n);
    const a = TAU / n;
    const desfase = (azar(1000) / 1000 - 0.5) * a * 0.7; // cae en un punto aleatorio dentro de la casilla
    const localObjetivo = (w + 0.5) * a + desfase;
    const objetivoMod = (((-localObjetivo) % TAU) + TAU) % TAU;
    const vueltas = 8 + azar(3);
    const actualMod = ((rot % TAU) + TAU) % TAU;
    const desde = rot;
    const hasta = rot + vueltas * TAU + ((objetivoMod - actualMod + TAU) % TAU);
    const dur = 9000 + azar(1500);
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);

    function paso(ahora) {
      const t = Math.min(1, (ahora - t0) / dur);
      rot = desde + (hasta - desde) * ease(t);
      dibujar();
      actualizarTicker();
      if (t < 1) requestAnimationFrame(paso);
      else terminar(w);
    }
    requestAnimationFrame(paso);
  }

  function terminar(w) {
    girando = false;
    ganador = entradas[w];
    $("#spin").disabled = false;
    $("#reload").disabled = false;
    $("#w-num").textContent = ganador.numero;
    $("#w-name").textContent = ganador.nombre;
    $("#w-cel").textContent = ocultarCel(ganador.celular);
    $("#w-save").disabled = DEMO;
    $("#w-save").textContent = DEMO ? "Modo de ejemplo" : "Guardar resultado";
    setTimeout(() => { $("#win").classList.add("open"); confeti(); }, 500);
  }

  $("#w-save").addEventListener("click", async () => {
    const b = $("#w-save");
    b.disabled = true;
    try {
      await api("POST", { accion: "guardarGanador", numero: ganador.numero });
      b.textContent = "Resultado guardado ✓";
      toast("Quedó registrado en el panel");
    } catch (ex) { toast(ex.message); b.disabled = false; }
  });
  $("#w-close").addEventListener("click", () => $("#win").classList.remove("open"));

  // ── Confeti ──
  function confeti() {
    const c = $("#confetti"), g = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    const cols = ["#d7a03f", "#b5462e", "#fff", "#5b2a43", "#f3d9cf"];
    const ps = Array.from({ length: 220 }, () => ({
      x: c.width / 2 + (Math.random() - 0.5) * 200, y: c.height * 0.45,
      vx: (Math.random() - 0.5) * 22, vy: -Math.random() * 22 - 6,
      s: 6 + Math.random() * 8, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4,
      c: cols[Math.floor(Math.random() * cols.length)],
    }));
    const t0 = performance.now();
    (function f(t) {
      g.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => {
        p.vy += 0.5; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
      });
      if (t - t0 < 4500) requestAnimationFrame(f); else g.clearRect(0, 0, c.width, c.height);
    })(t0);
  }

  // ── Controles ──
  $("#spin").addEventListener("click", girar);
  $("#reload").addEventListener("click", () => cargar().then(() => toast("Participantes actualizados")).catch((e) => toast(e.message)));
  $("#sound").addEventListener("click", () => { sonido = !sonido; $("#sound").textContent = `Sonido: ${sonido ? "sí" : "no"}`; });
  $("#full").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !$("#v-app").hidden && !$("#win").classList.contains("open")) { e.preventDefault(); girar(); }
    if (e.key === "Escape") $("#win").classList.remove("open");
  });

  // ── Acceso ──
  function mostrar() {
    $("#v-login").hidden = true;
    $("#v-app").hidden = false;
    if (DEMO) document.body.insertAdjacentHTML("beforeend", `<div class="demo-tag">Modo de ejemplo</div>`);
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    clave = $("#pw").value;
    try {
      await cargar();
      try { sessionStorage.setItem(KEY, clave); } catch {}
      mostrar();
    } catch (ex) { $("#login-err").textContent = ex.message; }
  });

  document.fonts?.ready.then(() => dibujar());

  if (DEMO) { mostrar(); cargar(); }
  else if (clave) cargar().then(mostrar).catch(() => { try { sessionStorage.removeItem(KEY); } catch {} });
})();
