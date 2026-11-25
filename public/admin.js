(() => {
  const C = window.RIFA;
  const $ = (s) => document.querySelector(s);
  const cop = (v) => "$" + Math.round(v).toLocaleString("es-CO");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const celFmt = (c) => `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6)}`;
  const KEY = "rifa-admin-key";

  let clave = "";
  try { clave = sessionStorage.getItem(KEY) || ""; } catch {}
  let data = null;

  let tt;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(tt);
    tt = setTimeout(() => t.classList.remove("show"), 2600);
  }

  async function api(method, body) {
    const r = await fetch("/api/admin", {
      method,
      headers: { "content-type": "application/json", "x-admin-key": clave },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { salir(); throw new Error("Contraseña incorrecta"); }
    if (!r.ok) throw new Error(d.error || "Error del servidor");
    return d;
  }

  function salir() {
    clave = "";
    try { sessionStorage.removeItem(KEY); } catch {}
    $("#v-app").hidden = true;
    $("#v-login").hidden = false;
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    clave = $("#pw").value;
    $("#login-err").textContent = "";
    try {
      data = await api("GET");
      try { sessionStorage.setItem(KEY, clave); } catch {}
      mostrarApp();
    } catch (ex) {
      $("#login-err").textContent = ex.message;
    }
  });
  $("#logout").addEventListener("click", salir);

  function mostrarApp() {
    $("#v-login").hidden = true;
    $("#v-app").hidden = false;
    pintar();
  }

  async function recargar(silencioso) {
    try {
      data = await api("GET");
      pintar();
      if (!silencioso) toast("Actualizado");
    } catch (ex) { toast(ex.message); }
  }

  function hace(iso) {
    const min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return "hace un momento";
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
  }

  function pintar() {
    const { reservas, total, precio, huerfanos, sorteos } = data;
    const pag = reservas.filter((r) => r.estado === "pagado");
    const pen = reservas.filter((r) => r.estado !== "pagado");
    const nPag = pag.reduce((a, r) => a + r.numeros.length, 0);
    const nPen = pen.reduce((a, r) => a + r.numeros.length, 0);
    const libres = total - nPag - nPen - huerfanos.length;
    $("#s-pag").textContent = nPag;
    $("#s-pen").textContent = nPen;
    $("#s-lib").textContent = libres;
    $("#s-rec").textContent = cop(nPag * precio);
    $("#s-por").textContent = cop(nPen * precio);
    $("#b-p").style.width = (nPag / total) * 100 + "%";
    $("#b-a").style.width = (nPen / total) * 100 + "%";

    const q = $("#q").value.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    const fe = $("#f-estado").value;
    const lista = reservas.filter((r) => {
      if (fe && r.estado !== fe) return false;
      if (!q) return true;
      return (
        r.nombre.toLowerCase().includes(q) ||
        (qd && r.celular.includes(qd)) ||
        (qd && r.numeros.some((n) => n.includes(qd.padStart(3, "0")) || n === qd))
      );
    });

    $("#list").innerHTML = lista.length
      ? lista.map(fila).join("")
      : `<div class="empty">${reservas.length ? "Sin resultados para esta búsqueda." : "Todavía no hay números apartados."}</div>`;

    $("#orphans-wrap").hidden = !huerfanos.length;
    $("#orphans").innerHTML = huerfanos
      .map((n) => `<button class="btn danger sm" data-act="huerfano" data-n="${n}">Liberar ${n}</button>`)
      .join("");

    $("#winners-wrap").hidden = !sorteos.length;
    $("#winners").innerHTML = sorteos
      .map((s) => `<div class="row"><div class="who"><b>${esc(s.nombre)}</b> — número <b>${s.numero}</b>
        <div class="meta">${celFmt(s.celular)} · ${new Date(s.fecha).toLocaleString("es-CO")}</div></div></div>`)
      .join("");
  }

  function fila(r) {
    const pagado = r.estado === "pagado";
    const msgRecordatorio = `Hola ${r.nombre.split(" ")[0]}, te escribimos de la rifa de ${C.organiza}. Tienes apartado${r.numeros.length > 1 ? "s los números" : " el número"} ${r.numeros.join(", ")} por ${cop(r.total)}. ¿Nos confirmas el pago? Nequi: ${C.nequi}.`;
    const msgConfirma = `Hola ${r.nombre.split(" ")[0]}, confirmamos tu pago en la rifa de ${C.organiza}. Tu${r.numeros.length > 1 ? "s números" : " número"}: ${r.numeros.join(", ")}. ¡Mucha suerte y gracias por ayudar!`;
    const wa = `https://wa.me/57${r.celular}?text=${encodeURIComponent(pagado ? msgConfirma : msgRecordatorio)}`;
    return `<div class="row ${pagado ? "pagado" : ""}">
      <div class="who">
        <b>${esc(r.nombre)}</b><span class="badge ${r.estado}">${r.estado}</span>
        <div class="meta"><a href="${wa}" target="_blank" rel="noopener">${celFmt(r.celular)}</a> · ${hace(r.creado)}${pagado && r.pagadoEn ? " · pagó " + hace(r.pagadoEn) : ""}</div>
      </div>
      <div class="nums">${r.numeros.map((n) => `<span class="chip">${n}</span>`).join("")}<span class="amount">${cop(r.total)}</span></div>
      <div class="acts">
        ${pagado
          ? `<button class="btn ghost sm" data-act="pendiente" data-id="${r.id}">Marcar pendiente</button>`
          : `<button class="btn green sm" data-act="pagado" data-id="${r.id}">✓ Marcar pagado</button>`}
        <a class="btn ghost sm" href="${wa}" target="_blank" rel="noopener">${pagado ? "Enviar confirmación" : "Recordar pago"}</a>
        <button class="btn ghost sm" data-act="editar" data-id="${r.id}">Editar</button>
        <button class="btn danger sm" data-act="liberar" data-id="${r.id}">Liberar</button>
      </div>
    </div>`;
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const r = data.reservas.find((x) => x.id === b.dataset.id);

    if (act === "editar") {
      $("#e-id").value = r.id;
      $("#e-nombre").value = r.nombre;
      $("#e-cel").value = r.celular;
      $("#e-err").textContent = "";
      $("#m-edit").classList.add("open");
      return;
    }
    if (act === "liberar" && !confirm(`¿Liberar ${r.numeros.join(", ")} de ${r.nombre}? Los números quedarán disponibles otra vez y se borrará la reserva.`)) return;
    if (act === "huerfano" && !confirm(`¿Liberar el número ${b.dataset.n}?`)) return;

    b.disabled = true;
    try {
      if (act === "huerfano") await api("POST", { accion: "liberarHuerfano", numero: b.dataset.n });
      else await api("POST", { accion: act, id: r.id });
      toast({ pagado: "Marcado como pagado ✓", pendiente: "Marcado como pendiente", liberar: "Números liberados", huerfano: "Número liberado" }[act]);
      await recargar(true);
    } catch (ex) {
      toast(ex.message);
      b.disabled = false;
    }
  });

  $("#edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("POST", { accion: "editar", id: $("#e-id").value, nombre: $("#e-nombre").value, celular: $("#e-cel").value });
      $("#m-edit").classList.remove("open");
      toast("Datos actualizados");
      recargar(true);
    } catch (ex) { $("#e-err").textContent = ex.message; }
  });
  document.querySelectorAll(".modal").forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) m.classList.remove("open"); })
  );

  $("#q").addEventListener("input", () => data && pintar());
  $("#f-estado").addEventListener("change", () => data && pintar());
  $("#refresh").addEventListener("click", () => recargar());

  $("#csv").addEventListener("click", () => {
    const filas = [["Numero", "Nombre", "Celular", "Estado", "Fecha reserva", "Fecha pago", "Valor"]];
    data.reservas
      .flatMap((r) => r.numeros.map((n) => [n, r.nombre, r.celular, r.estado, r.creado, r.pagadoEn || "", data.precio]))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach((f) => filas.push(f));
    const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `rifa-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  });

  // Auto-actualizar cada 30 s mientras el panel está abierto
  setInterval(() => { if (clave && !document.hidden && !document.querySelector(".modal.open")) recargar(true); }, 30000);

  if (clave) api("GET").then((d) => { data = d; mostrarApp(); }).catch(() => salir());
})();
