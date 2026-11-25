# Rifa solidaria · Laura Zuluaga

Plataforma de rifa de 500 números ($50.000 c/u) con:

- **Página pública** (`/`): cuadrícula de números, selección múltiple, formulario (nombre + celular) y datos de pago (Nequi y Bre-B). Los números apartados quedan bloqueados para todos al instante.
- **Panel de administración** (`/admin.html`): marcar pagado / pendiente, liberar números, editar datos, recordar pago o confirmar por WhatsApp, buscar y descargar CSV.
- **Ruleta** (`/ruleta.html`): gira entre los números **pagados** y elige ganador al azar (aleatorio criptográfico). Se puede guardar el resultado. Tiene modo de ensayo: `/ruleta.html?demo`.

Funciona 100 % en Netlify: páginas estáticas + Netlify Functions + Netlify Blobs (base de datos incluida, no hay que configurar nada externo).

---

## Publicar (15 minutos)

### 1. Subir a GitHub
1. Crea un repositorio nuevo en GitHub (puede ser privado), por ejemplo `rifa-laura`.
2. Sube todo el contenido de esta carpeta (arrastrando los archivos en la web de GitHub o con `git push`).

### 2. Conectar con Netlify
1. Entra a [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub** y elige el repositorio.
2. No cambies nada en la configuración de build (ya viene en `netlify.toml`). Clic en **Deploy**.

### 3. Crear la contraseña del admin (obligatorio)
1. En Netlify: **Site configuration → Environment variables → Add a variable**.
2. Key: `ADMIN_PASSWORD` · Value: una contraseña fuerte (mínimo 12 caracteres).
3. Ve a **Deploys → Trigger deploy → Deploy site** para que tome la variable.

### 4. (Opcional) Dominio
En **Domain management** puedes cambiar el subdominio (ej. `rifa-laura.netlify.app`) o conectar un dominio propio.

---

## Antes de compartir el link: completar `public/config.js`

| Campo | Qué poner |
|---|---|
| `llaveBreB` | Ya viene con `@3174018670` (vacío = no se muestra) |
| `whatsapp` | Número que recibe comprobantes, con 57 adelante. Viene con el mismo número de Nequi |
| `fechaSorteo` | Texto con la fecha del sorteo, ej. `"Sábado 20 de diciembre · 7:00 p. m."` |

El precio, la cantidad de números (500) y el máximo por compra (20) están en `netlify/lib/rifa.mjs`.

Cada cambio que subas a GitHub se publica solo en Netlify.

---

## Cómo se opera

1. La persona elige números → deja sus datos → los números quedan **apartados** (gris rayado) y ve los datos de pago con un botón para mandar el comprobante por WhatsApp.
2. Cuando llega el comprobante, en el admin buscas a la persona y das **✓ Marcar pagado** (el número pasa a oscuro en la página). Con **Enviar confirmación** le escribes por WhatsApp con el mensaje ya armado.
3. Si alguien apartó y no pagó, usa **Recordar pago** o **Liberar** para devolver los números a la venta. Los apartados **no se liberan solos**: el panel muestra hace cuánto se apartó cada uno.
4. El día del sorteo abre `/ruleta.html` (idealmente en pantalla completa y en vivo). Solo participan números pagados. Barra espaciadora = girar. Después del giro, **Guardar resultado** lo deja registrado en el panel.

Ensaya antes con `/ruleta.html?demo` (datos de ejemplo, no guarda nada).

### Privacidad
La página pública solo muestra si un número está libre, apartado o pagado; nunca nombres ni celulares. El admin y la ruleta piden la contraseña. La ruleta muestra el celular del ganador parcialmente oculto.

### Después de la rifa
Para borrar todos los datos: Netlify → **Blobs** (en el menú del sitio) → store `rifa-laura` → eliminar.

---

## Nota legal
En Colombia las rifas son monopolio del Estado y requieren autorización de Coljuegos (o de la entidad territorial, si es local). Revísalo antes de vender números y, si la obtienen, agrega el número de resolución en el pie de la página (`public/index.html`).

---

## Estructura

```
public/
  index.html, app.js      Página pública
  admin.html, admin.js    Panel de administración
  ruleta.html, ruleta.js  Ruleta
  config.js               Textos y medios de pago
  styles.css              Estilos compartidos
netlify/
  functions/numeros.mjs   GET  /api/numeros   (público, sin datos personales)
  functions/apartar.mjs   POST /api/apartar   (bloqueo atómico por número)
  functions/admin.mjs     GET/POST /api/admin (requiere contraseña)
  lib/rifa.mjs            Parámetros y utilidades
netlify.toml
package.json
```
