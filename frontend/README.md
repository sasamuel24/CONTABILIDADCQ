
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
  omiten la validación de área y muestran "Todas las Tiendas". La columna "Area
  Receptora" identifica la tienda de cada factura. Captura OCT/ECT/FPC y envía a
  Contabilidad con el mismo `ResponsableFacturaDetail` que un responsable de tienda.
  El alta del usuario se hace con `backend/create_responsable_tiendas.py`.

  ### Envío Contabilidad → Tesorería

  `ContabilidadFacturaDetail.tsx` envía a Tesorería con `asignarFactura` (área +
  usuario), que en el backend exige que la factura esté en estado **1, 2 o 3**. Una
  factura en Contabilidad debe quedar en estado_id=3 ("Pendiente en contabilidad");
  si quedó en id=4 ("Pendiente") muestra el error *"solo puede ser asignada si está
  en estado Recibida/Asignada/En contabilidad"* (ver `backend/agents.md` → Estados).
  