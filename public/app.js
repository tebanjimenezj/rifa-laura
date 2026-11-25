(() => {
  const C = window.RIFA;
  const $ = (s) => document.querySelector(s);
  const cop = (v) => "$" + Math.round(v).toLocaleString("es-CO");
  const pad = (n) => String(n).padStart(3, "0");

  const state = {
    total: 500,
    precio: 50000,
    max: 20,
    ocupados: new Set(),
    pagados: new Set(),
    sel: new Set(),
    built: false,
  };

  // ── Textos desde config ──
  $("#titulo").textContent = C.titulo;
  $("#organiza").textContent = C.organiza;
  $("#foot-org").textContent = C.organiza;
  $("#premio").textContent = C.premio;
  $("#valor").textContent = cop(C.valorPremio);
  if (C.fechaSorteo) {
    $("#fecha-k").textContent = "Sorteo";
    $("#fecha-v").textContent = C.fechaSorteo;
    $("#fecha-v").style.fontSize = "1.05rem";
  }

  // ── Toast ──
  let tt;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(tt);
    tt = setTimeout(() => t.classList.remove("show"), 2600);
  }

  async function copiar(txt) {
    try { await navigator.clipboard.writeText(txt); toast("Copiado: " + txt); }
    catch { toast(txt); }
  }

  // ── Medios de pago ──
  function metodosHTML() {
    const items = [];
    items.push(`<div class="method"><div><div class="k">Nequi</div><div class="v">${C.nequi}</div></div>
      <button class="btn ghost sm" data-copy="${C.nequi}" type="button">Copiar</button></div>`);
    if (C.llaveBreB) {
      items.push(`<div class="method"><div><div class="k">Llave Bre-B</div><div class="v">${C.llaveBreB}</div></div>
        <button class="btn ghost sm" data-copy="${C.llaveBreB}" type="button">Copiar</button></div>`);
    }
    if (C.qrImagen) {
      items.push(`<div class="method qr-box" style="flex-direction:column;align-items:stretch">
        <div class="k">Código QR</div>
        <img class="qr" src="${C.qrImagen}" alt="Código QR para pagar" onerror="this.closest('.qr-box').remove()" /></div>`);
    }
    return items.join("");
  }
  $("#pay-grid").innerHTML = metodosHTML();
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (b) copiar(b.dataset.copy);
  });

  // ── Cuadrícula ──
  const grid = $("#grid");

  function construir() {
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= state.total; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "n";
      b.textContent = pad(i);
      b.dataset.n = pad(i);
      frag.appendChild(b);
    }
    grid.innerHTML = "";
    grid.appendChild(frag);
    state.built = true;
  }

  function pintar() {
    const soloLibres = $("#solo-libres").checked;
    const q = $("#buscar").value.replace(/\D/g, "");
    for (const b of grid.children) {
      const n = b.dataset.n;
      const paid = state.pagados.has(n);
      const res = !paid && state.ocupados.has(n);
      b.classList.toggle("paid", paid);
      b.classList.toggle("res", res);
      b.classList.toggle("sel", state.sel.has(n));
      b.disabled = paid || res;
      b.setAttribute("aria-label", `Número ${n}${paid ? ", pagado" : res ? ", apartado" : ""}`);
      const oculto = (soloLibres && (paid || res)) || (q && !n.includes(q));
      b.classList.toggle("hide", !!oculto);
    }
    const ocupados = state.ocupados.size;
    $("#prog-txt").textContent = `${ocupados} de ${state.total}`;
    $("#prog-bar").style.width = (ocupados / state.total) * 100 + "%";
    pintarCarrito();
  }

  function pintarCarrito() {
    const n = state.sel.size;
    $("#cart").classList.toggle("show", n > 0);
    document.body.classList.toggle("has-cart", n > 0);
    if (!n) return;
    const lista = [...state.sel].sort();
    $("#cart-count").textContent = `${n} número${n > 1 ? "s" : ""}: ${lista.join(", ")}`;
    $("#cart-sum").textContent = cop(n * state.precio);
  }

  grid.addEventListener("click", (e) => {
    const b = e.target.closest(".n");
    if (!b || b.disabled) return;
    const n = b.dataset.n;
    if (state.sel.has(n)) state.sel.delete(n);
    else {
      if (state.sel.size >= state.max) return toast(`Máximo ${state.max} números por compra`);
      state.sel.add(n);
    }
    b.classList.toggle("sel", state.sel.has(n));
    pintarCarrito();
  });

  $("#solo-libres").addEventListener("change", pintar);
  $("#buscar").addEventListener("input", pintar);
  $("#buscar").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = parseInt($("#buscar").value, 10);
    if (!q || q < 1 || q > state.total) return;
    const b = grid.querySelector(`[data-n="${pad(q)}"]`);
    $("#buscar").value = "";
    pintar();
    b.scrollIntoView({ behavior: "smooth", block: "center" });
    b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
  });

  $("#cart-clear").addEventListener("click", () => { state.sel.clear(); pintar(); });

  // ── Datos del servidor ──
  async function cargar() {
    try {
      const r = await fetch("/api/numeros", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      state.total = d.total;
      state.precio = d.precio;
      state.max = d.maxPorCompra;
      state.ocupados = new Set(d.ocupados);
      state.pagados = new Set(d.pagados);
      $("#precio").textContent = cop(d.precio);
      if (!C.fechaSorteo) $("#fecha-v").textContent = d.total;
      // Si alguien apartó un número que yo tenía seleccionado, lo quito
      let quitados = [];
      for (const n of state.sel) if (state.ocupados.has(n)) { state.sel.delete(n); quitados.push(n); }
      if (quitados.length) toast(`El ${quitados.join(", ")} lo acaba de apartar otra persona`);
      if (!state.built) construir();
      pintar();
    } catch (e) {
      if (!state.built) grid.innerHTML = `<div class="loading">No pudimos cargar los números. <a href="">Reintentar</a></div>`;
    }
  }
  cargar();
  setInterval(() => { if (!document.hidden) cargar(); }, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) cargar(); });

  // ── Modales ──
  function abrir(id) { $(id).classList.add("open"); }
  function cerrar(m) { m.classList.remove("open"); }
  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) cerrar(m); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal.open").forEach(cerrar);
  });

  $("#cart-go").addEventListener("click", () => {
    const lista = [...state.sel].sort();
    $("#mf-chips").innerHTML = lista.map((n) => `<span class="chip">${n}</span>`).join("");
    $("#mf-total").textContent = `${lista.length} × ${cop(state.precio)} = ${cop(lista.length * state.precio)}`;
    $("#f-err").textContent = "";
    abrir("#m-form");
    setTimeout(() => $("#f-nombre").focus(), 150);
  });

  // Formato del celular mientras escribe
  $("#f-cel").addEventListener("input", (e) => {
    let d = e.target.value.replace(/\D/g, "");
    if (d.startsWith("57") && d.length > 10) d = d.slice(2);
    d = d.slice(0, 10);
    e.target.value = [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(" ");
  });

  $("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#f-err");
    const nombre = $("#f-nombre").value.trim().replace(/\s+/g, " ");
    const celular = $("#f-cel").value.replace(/\D/g, "");
    if (nombre.split(" ").length < 2 || nombre.length < 5) return (err.textContent = "Escribe tu nombre y apellido.");
    if (!/^3\d{9}$/.test(celular)) return (err.textContent = "Escribe un celular de 10 dígitos que empiece por 3.");
    if (!$("#f-ok").checked) return (err.textContent = "Debes aceptar el uso de tus datos para la rifa.");

    const numeros = [...state.sel].sort();
    const btn = $("#f-btn");
    btn.disabled = true;
    btn.textContent = "Apartando…";
    err.textContent = "";
    try {
      const r = await fetch("/api/apartar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre, celular, numeros, web: e.target.web.value }),
      });
      const d = await r.json();
      if (r.status === 409) {
        (d.ocupados || []).forEach((n) => { state.sel.delete(n); state.ocupados.add(n); });
        pintar();
        cerrar($("#m-form"));
        toast(`${d.error} (${(d.ocupados || []).join(", ")})`);
        cargar();
        return;
      }
      if (!r.ok) throw new Error(d.error || "Error");
      exito(d, nombre);
    } catch (ex) {
      err.textContent = ex.message || "No pudimos apartar tus números. Intenta de nuevo.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Apartar y ver cómo pagar";
    }
  });

  function exito(d, nombre) {
    cerrar($("#m-form"));
    d.numeros.forEach((n) => state.ocupados.add(n));
    state.sel.clear();
    pintar();
    $("#md-chips").innerHTML = d.numeros.map((n) => `<span class="chip">${n}</span>`).join("");
    $("#md-total").textContent = cop(d.total);
    $("#md-methods").innerHTML = metodosHTML();
    const msg = `Hola, soy ${nombre}. Aparté ${d.numeros.length > 1 ? "los números" : "el número"} ${d.numeros.join(", ")} de la rifa de ${C.organiza} por ${cop(d.total)}. Te envío el comprobante de pago.`;
    $("#md-wa").href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;
    $("#form").reset();
    abrir("#m-done");
  }
})();
