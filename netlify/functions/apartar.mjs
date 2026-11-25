// POST /api/apartar — aparta uno o más números a nombre de una persona.
// Cada número se bloquea con una escritura atómica (onlyIfNew): si dos personas
// intentan el mismo número al mismo tiempo, solo una lo consigue.
import {
  store, json, pad, nuevoId, limpiarCelular, limpiarNombre, TOTAL, PRECIO, MAX_POR_COMPRA,
} from "../lib/rifa.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }

  // Campo trampa para bots: las personas no lo ven ni lo llenan.
  if (body.web) return json({ error: "Solicitud rechazada" }, 400);

  const nombre = limpiarNombre(body.nombre);
  if (!nombre) return json({ error: "Escribe tu nombre completo (nombre y apellido)." }, 400);

  const celular = limpiarCelular(body.celular);
  if (!celular) return json({ error: "Escribe un celular válido de 10 dígitos (ej. 3001234567)." }, 400);

  const lista = Array.isArray(body.numeros) ? body.numeros : [];
  const numeros = [...new Set(lista.map((n) => parseInt(n, 10)))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL)
    .sort((a, b) => a - b)
    .map(pad);

  if (numeros.length === 0 || numeros.length !== lista.length)
    return json({ error: "Revisa los números seleccionados." }, 400);
  if (numeros.length > MAX_POR_COMPRA)
    return json({ error: `Puedes apartar máximo ${MAX_POR_COMPRA} números por compra.` }, 400);

  const s = store();
  const id = nuevoId();
  const ahora = new Date().toISOString();

  // 1) Bloquear los números uno por uno, en orden ascendente.
  //    El orden fijo evita que dos compras que se cruzan se bloqueen mutuamente
  //    y ambas fallen: siempre gana una.
  const logrados = [];
  const deshacer = () => Promise.all(logrados.map((n) => s.delete(`num/${n}`).catch(() => {})));

  for (const n of numeros) {
    let ok = false;
    try {
      ({ modified: ok } = await s.setJSON(`num/${n}`, { r: id, t: ahora }, { onlyIfNew: true }));
    } catch (e) {
      console.error(e);
      await deshacer();
      return json({ error: "Hubo un problema de conexión. Intenta de nuevo." }, 500);
    }
    if (!ok) {
      await deshacer();
      return json(
        { error: "Alguien acaba de apartar uno de tus números. Elige otro.", ocupados: [n] },
        409
      );
    }
    logrados.push(n);
  }

  // 2) Guardar la reserva
  const reserva = {
    id, nombre, celular, numeros,
    total: numeros.length * PRECIO,
    estado: "pendiente",
    creado: ahora,
    pagadoEn: null,
  };
  try {
    await s.setJSON(`res/${id}`, reserva);
  } catch (e) {
    console.error(e);
    await deshacer();
    return json({ error: "No pudimos guardar tu reserva. Intenta de nuevo." }, 500);
  }

  return json({ ok: true, id, numeros, total: reserva.total });
};

export const config = { path: "/api/apartar" };
