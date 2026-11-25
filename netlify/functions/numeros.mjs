// GET /api/numeros — estado público de la cuadrícula (sin datos personales).
import { store, listKeys, json, TOTAL, PRECIO, MAX_POR_COMPRA } from "../lib/rifa.mjs";

export default async () => {
  try {
    const s = store();
    const [ocupados, pagados] = await Promise.all([listKeys(s, "num/"), listKeys(s, "pag/")]);
    return json({ total: TOTAL, precio: PRECIO, maxPorCompra: MAX_POR_COMPRA, ocupados, pagados });
  } catch (e) {
    console.error(e);
    return json({ error: "No pudimos cargar los números. Intenta de nuevo." }, 500);
  }
};

export const config = { path: "/api/numeros" };
