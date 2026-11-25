// Lógica compartida de la rifa (la importan todas las funciones).
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

// ── Parámetros de la rifa (el servidor es la fuente de verdad) ──
export const TOTAL = 500;          // cantidad de números (001 a 500)
export const PRECIO = 50000;       // valor de cada número en COP
export const MAX_POR_COMPRA = 20;  // máximo de números por persona en una sola compra

// Estructura en Netlify Blobs (store "rifa-laura"):
//   num/NNN      -> { r: idReserva, t: fecha }   candado del número (se crea con onlyIfNew = atómico)
//   pag/NNN      -> { r: idReserva }             marca de número pagado
//   res/ID       -> { id, nombre, celular, numeros, total, estado, creado, pagadoEn }
//   sorteo/FECHA -> { numero, nombre, celular, fecha }
export const store = () => getStore({ name: "rifa-laura", consistency: "strong" });

export const pad = (n) => String(n).padStart(3, "0");

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function listKeys(s, prefix) {
  const { blobs } = await s.list({ prefix });
  return blobs.map((b) => b.key.slice(prefix.length));
}

const sha = (v) => createHash("sha256").update(String(v)).digest();

export function isAdmin(req) {
  const esperado = process.env.ADMIN_PASSWORD;
  if (!esperado) return false;
  const recibido = req.headers.get("x-admin-key") || "";
  return timingSafeEqual(sha(recibido), sha(esperado));
}

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Normaliza y valida un celular colombiano. Devuelve "3XXXXXXXXX" o null.
export function limpiarCelular(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}

export function limpiarNombre(v) {
  const n = String(v || "").replace(/\s+/g, " ").trim();
  if (n.length < 5 || n.length > 80) return null;
  if (n.split(" ").length < 2) return null; // nombre y apellido
  if (/[<>{}]/.test(n)) return null;
  return n;
}

export async function leerReservas(s) {
  const ids = await listKeys(s, "res/");
  const datos = await Promise.all(ids.map((id) => s.get(`res/${id}`, { type: "json" })));
  return datos.filter(Boolean);
}
