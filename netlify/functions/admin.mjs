// /api/admin — panel de administración y ruleta. Requiere el encabezado x-admin-key.
//   GET  -> reservas, números huérfanos y sorteos guardados
//   POST -> { accion: "pagado" | "pendiente" | "liberar" | "editar" | "liberarHuerfano" | "guardarGanador", ... }
import {
  store, json, listKeys, leerReservas, isAdmin, pad, limpiarCelular, limpiarNombre, TOTAL, PRECIO,
} from "../lib/rifa.mjs";

export default async (req) => {
  if (!process.env.ADMIN_PASSWORD)
    return json({ error: "Falta configurar ADMIN_PASSWORD en Netlify." }, 500);
  if (!isAdmin(req)) return json({ error: "Contraseña incorrecta" }, 401);

  const s = store();

  try {
    if (req.method === "GET") {
      const [reservas, ocupados, sorteoIds] = await Promise.all([
        leerReservas(s),
        listKeys(s, "num/"),
        listKeys(s, "sorteo/"),
      ]);
      const enReservas = new Set(reservas.flatMap((r) => r.numeros));
      const huerfanos = ocupados.filter((n) => !enReservas.has(n));
      const sorteos = (await Promise.all(sorteoIds.map((k) => s.get(`sorteo/${k}`, { type: "json" }))))
        .filter(Boolean)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      reservas.sort((a, b) => b.creado.localeCompare(a.creado));
      return json({ total: TOTAL, precio: PRECIO, reservas, huerfanos, sorteos });
    }

    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

    const body = await req.json().catch(() => ({}));
    const { accion } = body;

    if (accion === "liberarHuerfano") {
      const n = pad(parseInt(body.numero, 10));
      const reservas = await leerReservas(s);
      if (reservas.some((r) => r.numeros.includes(n)))
        return json({ error: "Ese número pertenece a una reserva." }, 400);
      await Promise.all([s.delete(`num/${n}`), s.delete(`pag/${n}`)]);
      return json({ ok: true });
    }

    if (accion === "guardarGanador") {
      const n = pad(parseInt(body.numero, 10));
      const candado = await s.get(`num/${n}`, { type: "json" });
      const reserva = candado && (await s.get(`res/${candado.r}`, { type: "json" }));
      if (!reserva || reserva.estado !== "pagado")
        return json({ error: "Ese número no está pagado." }, 400);
      const fecha = new Date().toISOString();
      const registro = { numero: n, nombre: reserva.nombre, celular: reserva.celular, idReserva: reserva.id, fecha };
      await s.setJSON(`sorteo/${fecha}`, registro);
      return json({ ok: true, sorteo: registro });
    }

    // Acciones sobre una reserva
    const id = String(body.id || "");
    const reserva = id && (await s.get(`res/${id}`, { type: "json" }));
    if (!reserva) return json({ error: "Reserva no encontrada" }, 404);

    if (accion === "pagado") {
      await Promise.all(reserva.numeros.map((n) => s.setJSON(`pag/${n}`, { r: id })));
      reserva.estado = "pagado";
      reserva.pagadoEn = new Date().toISOString();
      await s.setJSON(`res/${id}`, reserva);
      return json({ ok: true, reserva });
    }

    if (accion === "pendiente") {
      await Promise.all(reserva.numeros.map((n) => s.delete(`pag/${n}`)));
      reserva.estado = "pendiente";
      reserva.pagadoEn = null;
      await s.setJSON(`res/${id}`, reserva);
      return json({ ok: true, reserva });
    }

    if (accion === "editar") {
      const nombre = limpiarNombre(body.nombre);
      const celular = limpiarCelular(body.celular);
      if (!nombre || !celular) return json({ error: "Nombre o celular inválido" }, 400);
      reserva.nombre = nombre;
      reserva.celular = celular;
      await s.setJSON(`res/${id}`, reserva);
      return json({ ok: true, reserva });
    }

    if (accion === "liberar") {
      // Solo se borran los candados que realmente pertenecen a esta reserva.
      await Promise.all(
        reserva.numeros.map(async (n) => {
          const candado = await s.get(`num/${n}`, { type: "json" });
          if (candado && candado.r === id) await s.delete(`num/${n}`);
          await s.delete(`pag/${n}`);
        })
      );
      await s.delete(`res/${id}`);
      return json({ ok: true });
    }

    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor. Intenta de nuevo." }, 500);
  }
};

export const config = { path: "/api/admin" };
