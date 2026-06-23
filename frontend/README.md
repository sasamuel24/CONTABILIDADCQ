
  # Contabilidad

  This is a code bundle for Contabilidad. The original project is available at https://www.figma.com/design/v9t8GT8zLZreOlGFEsAsyJ/Contabilidad.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Notas de flujo de facturas (gotchas)

  ### Auto-envío a Contabilidad y Gastos Fijos (GADMIN)

  `InboxView.tsx` dispara `autoEnviarContabilidad()` tras cada carga, **solo para
  rol `responsable`**, para enviar solas a Contabilidad las facturas que aparecen
  como "Listo".

  ⚠️ El área **Gastos Fijos Café Quindío** (`area.code === 'GADMIN'`) usa rol
  `responsable` pero su flujo va **directo a Tesorería** (`submitGadminTesoreria`,
  botón "Enviar a Tesorería" en `ResponsableFacturaDetail.tsx`), NO a Contabilidad.
  Por eso `InboxView` tiene la guardia `esGadmin` que evita el auto-envío para esa
  área; sin ella, las facturas rebotan de vuelta a Contabilidad. El backend también
  excluye GADMIN del barrido (defensa en profundidad).

  ### Perfil "Responsable de Tiendas" (multi-tienda)

  Rol `responsable_tiendas`: reutiliza `ResponsablePage`/`InboxView` pero su bandeja
  carga las facturas de **todas** las tiendas (`getFacturas(..., solo_tiendas=true)`)
  en vez de una sola área. No tiene `area` asignada → `InboxView` y `ResponsablePage`
  omiten la validación de área y muestran "Todas las Tiendas". Captura OCT/ECT/FPC y
  envía a Contabilidad con el mismo `ResponsableFacturaDetail` que un responsable de
  tienda. El alta del usuario se hace con `backend/create_responsable_tiendas.py`.

  Puntos de integración en el frontend (todos condicionados a `responsable_tiendas`):
  - **Ruteo**: `App.tsx` (`roleRedirect` → `/responsable`) y `ProtectedRoute`
    (`allowedRoles` incluye `responsable_tiendas`, y `getRoleHome`). Si faltara, el
    usuario cae en `/no-autorizado`.
  - **Carga**: `InboxView.loadInboxData` usa `solo_tiendas=true` y NO exige área.
  - **Detalle**: en `InboxView` el componente de detalle se elige por rol; el bloque
    `user?.role === 'responsable' || user?.role === 'responsable_tiendas'` debe abrir
    `ResponsableFacturaDetail` (si no, cae en el modal genérico de solo lectura).
  - **Filtro por tienda (tipo Excel)**: componente `AreaFilterPopover` (embudo) en la
    cabecera de la columna "Area Receptora"; búsqueda + checkboxes multi-selección.
    Solo se muestra para `responsable_tiendas`. La columna "Area Receptora" identifica
    la tienda de cada factura.
  - **Menú**: `ResponsablePage` oculta "Legalizar Anticipo" para este perfil.

  ### Desarrollo local (gotchas que costaron tiempo)

  - **Vite corre en el puerto `3000`** (`vite.config.ts → server.port: 3000`), no en
    5173. La URL local es `http://localhost:3000`.
  - El backend local debe correr en **`8001`** (es lo que apunta `VITE_API_BASE_URL`
    en `.env`/`.env.local`). Si lo levantas en otro puerto → `ERR_CONNECTION_REFUSED`
    en `/auth/login`.
  - **`dist/` puede estar viejo.** `npm run dev` sirve el fuente fresco; pero si abres
    un build (`npm run preview` o un estático sirviendo `dist/`) con `dist` desactualizado,
    verás comportamiento viejo (p. ej. "No Autorizado" para roles nuevos). Para probar
    cambios usa `npm run dev`; para producción **recompila** con `npm run build`.
  - Tras cambios de **ruteo/estructura**, el HMR de Vite a veces no aplica del todo.
    Si ves comportamiento viejo: reinicia `npm run dev`, borra caché (`rm -rf
    node_modules/.vite`) y abre en **ventana de incógnito** (descarta caché del
    navegador Y extensiones — algunas inyectan scripts/recursos `_next` ajenos a la app).

  ### Envío Contabilidad → Tesorería

  `ContabilidadFacturaDetail.tsx` envía a Tesorería con `asignarFactura` (área +
  usuario), que en el backend exige que la factura esté en estado **1, 2 o 3**. Una
  factura en Contabilidad debe quedar en estado_id=3 ("Pendiente en contabilidad");
  si quedó en id=4 ("Pendiente") muestra el error *"solo puede ser asignada si está
  en estado Recibida/Asignada/En contabilidad"* (ver `backend/agents.md` → Estados).
  