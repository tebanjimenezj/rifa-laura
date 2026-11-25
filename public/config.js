// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN DE LA RIFA — edita aquí los textos y medios de pago
//  (el precio, la cantidad de números y el máximo por compra
//   se cambian en netlify/lib/rifa.mjs)
// ─────────────────────────────────────────────────────────────
window.RIFA = {
  organiza: "Laura Zuluaga",
  titulo: "Una madre empresaria necesita ayuda para recuperar a sus hijos",
  premio: "Paquete de obras artísticas",
  valorPremio: 12000000,

  // Texto opcional. Ej: "Sábado 20 de diciembre · 7:00 p. m. · En vivo por Instagram"
  fechaSorteo: "",

  // Medios de pago
  nequi: "3174018670",
  llaveBreB: "@3174018670",      // Vacío = no se muestra

  // WhatsApp para recibir comprobantes (57 + número, sin espacios)
  whatsapp: "573174018670",
};
