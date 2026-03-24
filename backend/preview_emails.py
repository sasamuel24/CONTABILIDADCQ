"""
preview_emails.py
-----------------
Genera todos los templates de correo como archivos HTML y los abre en el navegador.
No requiere levantar el backend ni conexión a base de datos.

Uso:
    cd backend
    python preview_emails.py
"""
import os
import webbrowser
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace

# ---------------------------------------------------------------------------
# Datos de prueba (mock)
# ---------------------------------------------------------------------------

FRONTEND_URL = "http://localhost:3000"
TOKEN_PRUEBA = "abc123xyz_token_de_prueba_72h"

tecnico = SimpleNamespace(
    nombre="Andrés Reyes Muñoz",
    email="tecnicomedellin@cafequindio.com.co",
)

gastos = [
    SimpleNamespace(
        fecha=date(2026, 3, 24),
        pagado_a="Estación Texaco La 80",
        concepto="Combustible vehículo Mantenimiento",
        valor_pagado=85_000,
        estado_gasto="pendiente",
    ),
    SimpleNamespace(
        fecha=date(2026, 3, 25),
        pagado_a="Hotel Estelar Medellín",
        concepto="Hospedaje visita técnica tienda centro",
        valor_pagado=220_000,
        estado_gasto="pendiente",
    ),
    SimpleNamespace(
        fecha=date(2026, 3, 26),
        pagado_a="Restaurante El Rancherito",
        concepto="Alimentación técnicos en visita",
        valor_pagado=45_000,
        estado_gasto="devuelto",
    ),
]

paquete = SimpleNamespace(
    id="df34c220-c655-46b0-b0d2-38767b470a99",
    folio="PKG-2026-00013",
    semana="2026-W14",
    fecha_inicio=date(2026, 3, 30),
    fecha_fin=date(2026, 4, 5),
    monto_total=350_000,
    monto_a_pagar=305_000,   # sin el gasto devuelto
    fecha_pago=datetime(2026, 3, 27, 14, 35, 0),
    tecnico=tecnico,
    gastos=gastos,
)


# ---------------------------------------------------------------------------
# Helpers de formato (igual que en email_service.py)
# ---------------------------------------------------------------------------

def fmt(v: float) -> str:
    return f"${v:,.2f}"


def fd(d: date) -> str:
    return d.strftime("%d/%m/%Y")


# ---------------------------------------------------------------------------
# Templates (copia fiel de email_service.py, sin async/settings)
# ---------------------------------------------------------------------------

def tpl_solicitud_aprobacion() -> tuple[str, str]:
    """Para: Gerente Administrativo — link de aprobación con token."""
    folio = paquete.folio
    nombre_tecnico = paquete.tecnico.nombre
    semana = paquete.semana
    fecha_inicio = fd(paquete.fecha_inicio)
    fecha_fin = fd(paquete.fecha_fin)
    monto_total = float(paquete.monto_total)
    aprobacion_url = f"{FRONTEND_URL}/aprobar-paquete?token={TOKEN_PRUEBA}"

    filas_gastos = ""
    for g in paquete.gastos:
        filas_gastos += (
            f"<tr>"
            f"<td style='padding:6px;border:1px solid #ddd'>{fd(g.fecha)}</td>"
            f"<td style='padding:6px;border:1px solid #ddd'>{g.pagado_a}</td>"
            f"<td style='padding:6px;border:1px solid #ddd'>{g.concepto}</td>"
            f"<td style='padding:6px;border:1px solid #ddd;text-align:right'>{fmt(float(g.valor_pagado))}</td>"
            f"</tr>"
        )

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333">
    <h2 style="color:#1a3c6e">Solicitud de Aprobación de Gastos</h2>
    <p>Se ha enviado un paquete de gastos para su aprobación.</p>
    <table style="border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:4px 12px;font-weight:bold">Folio:</td><td>{folio}</td></tr>
      <tr><td style="padding:4px 12px;font-weight:bold">Técnico:</td><td>{nombre_tecnico}</td></tr>
      <tr><td style="padding:4px 12px;font-weight:bold">Semana:</td><td>{semana} ({fecha_inicio} – {fecha_fin})</td></tr>
      <tr><td style="padding:4px 12px;font-weight:bold">Monto Total:</td>
          <td style="font-size:1.1em;font-weight:bold;color:#1a6e3c">{fmt(monto_total)} COP</td></tr>
    </table>
    <h3>Detalle de Gastos</h3>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
      <thead>
        <tr style="background:#1a3c6e;color:#fff">
          <th style="padding:8px;border:1px solid #ddd">Fecha</th>
          <th style="padding:8px;border:1px solid #ddd">Pagado a</th>
          <th style="padding:8px;border:1px solid #ddd">Concepto</th>
          <th style="padding:8px;border:1px solid #ddd">Valor</th>
        </tr>
      </thead>
      <tbody>{filas_gastos}</tbody>
    </table>
    <p>Para aprobar este paquete, haga clic en el siguiente enlace (válido por 72 horas):</p>
    <p>
      <a href="{aprobacion_url}"
         style="background:#1a6e3c;color:#fff;padding:10px 22px;border-radius:4px;
                text-decoration:none;font-weight:bold;display:inline-block">
        Aprobar Paquete {folio}
      </a>
    </p>
    <p style="color:#888;font-size:0.85em">
      Si no puede hacer clic en el botón, copie y pegue este enlace en su navegador:<br>
      {aprobacion_url}
    </p>
    <hr style="margin-top:30px">
    <p style="color:#aaa;font-size:0.8em">
      Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
    </p>
    </body></html>
    """
    subject = f"Solicitud de Aprobación - Paquete {folio} - Técnico {nombre_tecnico}"
    return subject, html


def tpl_notificacion_aprobado_facturacion() -> tuple[str, str]:
    """Para: Facturación — paquete aprobado, listo para Tesorería."""
    folio = paquete.folio
    nombre_tecnico = paquete.tecnico.nombre
    monto_total = float(paquete.monto_total)

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333">
    <h2 style="color:#1a6e3c">Paquete de Gastos Aprobado</h2>
    <p>El siguiente paquete de gastos ha sido aprobado y está listo para enviar a Tesorería.</p>
    <table style="border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:4px 12px;font-weight:bold">Folio:</td><td>{folio}</td></tr>
      <tr><td style="padding:4px 12px;font-weight:bold">Técnico:</td><td>{nombre_tecnico}</td></tr>
      <tr><td style="padding:4px 12px;font-weight:bold">Semana:</td><td>{paquete.semana}</td></tr>
      <tr><td style="padding:4px 12px;font-weight:bold">Monto Total:</td>
          <td style="font-size:1.1em;font-weight:bold;color:#1a6e3c">{fmt(monto_total)} COP</td></tr>
    </table>
    <p>El paquete ha pasado al estado <strong>Aprobado</strong>.
       Puede proceder a enviarlo a Tesorería desde el sistema.</p>
    <hr style="margin-top:30px">
    <p style="color:#aaa;font-size:0.8em">
      Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
    </p>
    </body></html>
    """
    subject = f"Paquete Aprobado - {folio} - {nombre_tecnico}"
    return subject, html


def tpl_aviso_responsable() -> tuple[str, str]:
    """Para: Responsable de Mantenimiento — técnico envió paquete para revisión."""
    folio = paquete.folio
    nombre_tecnico = paquete.tecnico.nombre
    semana = paquete.semana
    fecha_inicio = fd(paquete.fecha_inicio)
    fecha_fin = fd(paquete.fecha_fin)
    monto_total = float(paquete.monto_total)
    total_gastos = len(paquete.gastos)

    filas_gastos = ""
    for g in paquete.gastos:
        filas_gastos += (
            f"<tr>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{fd(g.fecha)}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.pagado_a}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.concepto}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd;text-align:right'>{fmt(float(g.valor_pagado))}</td>"
            f"</tr>"
        )

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
    <div style="background:#1a3c6e;padding:18px 24px;border-radius:6px 6px 0 0">
      <h2 style="color:#fff;margin:0">Paquete de Gastos Pendiente de Revisión</h2>
      <p style="color:#cce0ff;margin:4px 0 0">Sistema de Legalización de Gastos</p>
    </div>
    <div style="border:1px solid #dde;border-top:none;padding:24px;border-radius:0 0 6px 6px">
      <p>El técnico <strong>{nombre_tecnico}</strong> ha enviado un paquete de gastos para su revisión.</p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold;width:160px">Folio:</td>
          <td style="padding:8px 14px">{folio}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-weight:bold">Técnico:</td>
          <td style="padding:8px 14px">{nombre_tecnico}</td>
        </tr>
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold">Semana:</td>
          <td style="padding:8px 14px">{semana} &nbsp;({fecha_inicio} – {fecha_fin})</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-weight:bold">N° de gastos:</td>
          <td style="padding:8px 14px">{total_gastos} ítem(s)</td>
        </tr>
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold">Monto Total:</td>
          <td style="padding:8px 14px;font-size:1.1em;font-weight:bold;color:#1a3c6e">{fmt(monto_total)} COP</td>
        </tr>
      </table>
      <h4 style="color:#1a3c6e;margin-bottom:6px">Detalle de Gastos</h4>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:0.9em">
        <thead>
          <tr style="background:#1a3c6e;color:#fff">
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Fecha</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Pagado a</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Concepto</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:right">Valor</th>
          </tr>
        </thead>
        <tbody>{filas_gastos}</tbody>
      </table>
      <p>Ingrese al sistema para revisar el paquete y, si todo está correcto,
         envíe el correo de aprobación al Gerente desde el botón
         <em>"Enviar correo de aprobación"</em>.</p>
      <p>
        <a href="{FRONTEND_URL}"
           style="background:#1a3c6e;color:#fff;padding:10px 22px;border-radius:4px;
                  text-decoration:none;font-weight:bold;display:inline-block">
          Revisar Paquete en el Sistema
        </a>
      </p>
      <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
      <p style="color:#aaa;font-size:0.8em">
        Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
      </p>
    </div>
    </body></html>
    """
    subject = f"Paquete Pendiente de Revisión - {folio} - {nombre_tecnico}"
    return subject, html


def tpl_confirmacion_creacion() -> tuple[str, str]:
    """Para: Técnico — confirmación de creación de paquete."""
    folio = paquete.folio
    nombre_tecnico = paquete.tecnico.nombre
    semana = paquete.semana
    fecha_inicio = fd(paquete.fecha_inicio)
    fecha_fin = fd(paquete.fecha_fin)

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto">
    <div style="background:#1a3c6e;padding:18px 24px;border-radius:6px 6px 0 0">
      <h2 style="color:#fff;margin:0">Nuevo Paquete Creado</h2>
      <p style="color:#cce0ff;margin:4px 0 0">Sistema de Legalización de Gastos</p>
    </div>
    <div style="border:1px solid #dde;border-top:none;padding:24px;border-radius:0 0 6px 6px">
      <p>Hola <strong>{nombre_tecnico}</strong>,</p>
      <p>Tu paquete de gastos ha sido creado exitosamente y está en estado <strong>Borrador</strong>.
         Recuerda agregar tus gastos y enviarlo para revisión.</p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold;width:140px">Folio:</td>
          <td style="padding:8px 14px">{folio}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-weight:bold">Semana:</td>
          <td style="padding:8px 14px">{semana} &nbsp;({fecha_inicio} – {fecha_fin})</td>
        </tr>
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold">Estado:</td>
          <td style="padding:8px 14px">
            <span style="background:#e8f0fe;color:#1a3c6e;padding:2px 10px;border-radius:12px;font-size:0.9em">
              Borrador
            </span>
          </td>
        </tr>
      </table>
      <p style="margin-top:20px">
        <a href="{FRONTEND_URL}"
           style="background:#1a3c6e;color:#fff;padding:10px 22px;border-radius:4px;
                  text-decoration:none;font-weight:bold;display:inline-block">
          Ir al Sistema
        </a>
      </p>
      <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
      <p style="color:#aaa;font-size:0.8em">
        Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
      </p>
    </div>
    </body></html>
    """
    subject = f"Paquete Creado - {folio} - Semana {semana}"
    return subject, html


def tpl_aprobado_tecnico() -> tuple[str, str]:
    """Para: Técnico — su paquete fue aprobado."""
    folio = paquete.folio
    nombre_tecnico = paquete.tecnico.nombre
    semana = paquete.semana
    fecha_inicio = fd(paquete.fecha_inicio)
    fecha_fin = fd(paquete.fecha_fin)
    monto_total = float(paquete.monto_total)

    filas_gastos = ""
    for g in paquete.gastos:
        estado_color = "#e8f5e9" if g.estado_gasto != "devuelto" else "#fdecea"
        filas_gastos += (
            f"<tr style='background:{estado_color}'>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{fd(g.fecha)}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.pagado_a}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.concepto}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd;text-align:right'>{fmt(float(g.valor_pagado))}</td>"
            f"</tr>"
        )

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
    <div style="background:#1a6e3c;padding:18px 24px;border-radius:6px 6px 0 0">
      <h2 style="color:#fff;margin:0">&#10003; ¡Tu Paquete fue Aprobado!</h2>
      <p style="color:#c8f7dc;margin:4px 0 0">Sistema de Legalización de Gastos</p>
    </div>
    <div style="border:1px solid #dde;border-top:none;padding:24px;border-radius:0 0 6px 6px">
      <p>Hola <strong>{nombre_tecnico}</strong>,</p>
      <p>Tu paquete de gastos ha sido <strong>aprobado</strong> y está en proceso de pago por Tesorería.</p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold;width:140px">Folio:</td>
          <td style="padding:8px 14px">{folio}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-weight:bold">Semana:</td>
          <td style="padding:8px 14px">{semana} &nbsp;({fecha_inicio} – {fecha_fin})</td>
        </tr>
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold">Monto Total:</td>
          <td style="padding:8px 14px;font-size:1.1em;font-weight:bold;color:#1a6e3c">{fmt(monto_total)} COP</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-weight:bold">Estado:</td>
          <td style="padding:8px 14px">
            <span style="background:#e8f5e9;color:#1a6e3c;padding:2px 10px;border-radius:12px;font-size:0.9em">
              Aprobado
            </span>
          </td>
        </tr>
      </table>
      <h4 style="color:#1a3c6e;margin-bottom:6px">Detalle de Gastos</h4>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:0.9em">
        <thead>
          <tr style="background:#1a3c6e;color:#fff">
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Fecha</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Pagado a</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Concepto</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:right">Valor</th>
          </tr>
        </thead>
        <tbody>{filas_gastos}</tbody>
      </table>
      <p>Pronto recibirás una notificación cuando el pago sea procesado.</p>
      <p>
        <a href="{FRONTEND_URL}"
           style="background:#1a6e3c;color:#fff;padding:10px 22px;border-radius:4px;
                  text-decoration:none;font-weight:bold;display:inline-block">
          Ver Estado del Paquete
        </a>
      </p>
      <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
      <p style="color:#aaa;font-size:0.8em">
        Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
      </p>
    </div>
    </body></html>
    """
    subject = f"¡Paquete Aprobado! - {folio} - Semana {semana}"
    return subject, html


def tpl_pago_tecnico() -> tuple[str, str]:
    """Para: Técnico — su paquete fue pagado por Tesorería."""
    folio = paquete.folio
    nombre_tecnico = paquete.tecnico.nombre
    semana = paquete.semana
    fecha_inicio = fd(paquete.fecha_inicio)
    fecha_fin = fd(paquete.fecha_fin)
    monto_a_pagar = float(paquete.monto_a_pagar)
    monto_total = float(paquete.monto_total)
    fecha_pago = paquete.fecha_pago.strftime("%d/%m/%Y %H:%M")

    hay_descuento = monto_a_pagar < monto_total
    fila_descuento = ""
    if hay_descuento:
        descuento = monto_total - monto_a_pagar
        fila_descuento = f"""
        <tr>
          <td style="padding:8px 14px;font-weight:bold">Descuento por devoluciones:</td>
          <td style="padding:8px 14px;color:#c0392b">-{fmt(descuento)} COP</td>
        </tr>"""

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto">
    <div style="background:#0d47a1;padding:18px 24px;border-radius:6px 6px 0 0">
      <h2 style="color:#fff;margin:0">&#9989; Pago Procesado</h2>
      <p style="color:#bbdefb;margin:4px 0 0">Sistema de Legalización de Gastos</p>
    </div>
    <div style="border:1px solid #dde;border-top:none;padding:24px;border-radius:0 0 6px 6px">
      <p>Hola <strong>{nombre_tecnico}</strong>,</p>
      <p>Tu paquete de gastos ha sido <strong>pagado y legalizado</strong> por Tesorería.</p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold;width:200px">Folio:</td>
          <td style="padding:8px 14px">{folio}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-weight:bold">Semana:</td>
          <td style="padding:8px 14px">{semana} &nbsp;({fecha_inicio} – {fecha_fin})</td>
        </tr>
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold">Monto Total del Paquete:</td>
          <td style="padding:8px 14px">{fmt(monto_total)} COP</td>
        </tr>
        {fila_descuento}
        <tr style="background:#e3f2fd">
          <td style="padding:8px 14px;font-weight:bold">Monto Pagado:</td>
          <td style="padding:8px 14px;font-size:1.15em;font-weight:bold;color:#0d47a1">{fmt(monto_a_pagar)} COP</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;font-weight:bold">Fecha de Pago:</td>
          <td style="padding:8px 14px">{fecha_pago}</td>
        </tr>
        <tr style="background:#f5f7fa">
          <td style="padding:8px 14px;font-weight:bold">Estado:</td>
          <td style="padding:8px 14px">
            <span style="background:#e8f5e9;color:#1a6e3c;padding:2px 10px;border-radius:12px;font-size:0.9em">
              Pagado / Legalizado
            </span>
          </td>
        </tr>
      </table>
      <p>
        <a href="{FRONTEND_URL}"
           style="background:#0d47a1;color:#fff;padding:10px 22px;border-radius:4px;
                  text-decoration:none;font-weight:bold;display:inline-block">
          Ver Comprobante
        </a>
      </p>
      <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
      <p style="color:#aaa;font-size:0.8em">
        Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
      </p>
    </div>
    </body></html>
    """
    subject = f"Pago Procesado - {folio} - Semana {semana}"
    return subject, html


# ---------------------------------------------------------------------------
# Catálogo de todos los correos
# ---------------------------------------------------------------------------

CORREOS = [
    ("01_solicitud_aprobacion_gerente",   "Gerente Administrativo",      tpl_solicitud_aprobacion),
    ("02_aprobado_facturacion",           "Facturación",                 tpl_notificacion_aprobado_facturacion),
    ("03_aviso_responsable",              "Responsable de Mantenimiento",tpl_aviso_responsable),
    ("04_confirmacion_creacion_tecnico",  "Técnico — creación",          tpl_confirmacion_creacion),
    ("05_aprobado_tecnico",               "Técnico — aprobación",        tpl_aprobado_tecnico),
    ("06_pago_tecnico",                   "Técnico — pago",              tpl_pago_tecnico),
]


# ---------------------------------------------------------------------------
# Generación del índice y archivos individuales
# ---------------------------------------------------------------------------

def build_index(items: list[dict]) -> str:
    tarjetas = ""
    for item in items:
        tarjetas += f"""
        <a href="{item['archivo']}" target="_blank" style="text-decoration:none">
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:18px 22px;
                      background:#fff;transition:box-shadow .15s;cursor:pointer"
               onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.10)'"
               onmouseout="this.style.boxShadow='none'">
            <div style="font-size:0.75em;font-weight:700;letter-spacing:.08em;
                        text-transform:uppercase;color:#94a3b8;margin-bottom:6px">
              {item['num']}
            </div>
            <div style="font-size:1.05em;font-weight:700;color:#1a3c6e;margin-bottom:4px">
              {item['asunto']}
            </div>
            <div style="font-size:0.85em;color:#64748b">
              Para: <strong>{item['para']}</strong>
            </div>
          </div>
        </a>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Preview — Correos CONTABILIDADCQ</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: Arial, sans-serif; background: #f1f5f9; padding: 40px 24px; }}
    h1 {{ color: #1a3c6e; font-size: 1.6em; margin-bottom: 6px; }}
    .sub {{ color: #64748b; font-size: 0.9em; margin-bottom: 32px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }}
    .badge {{ display:inline-block;background:#e8f0fe;color:#1a3c6e;
              font-size:0.75em;padding:2px 10px;border-radius:12px;margin-top:8px; }}
  </style>
</head>
<body>
  <h1>Correos — CONTABILIDADCQ</h1>
  <p class="sub">
    Datos de prueba: Paquete <strong>PKG-2026-00013</strong> &nbsp;·&nbsp;
    Técnico: <strong>Andrés Reyes Muñoz</strong> &nbsp;·&nbsp;
    Semana 14 — 2026
  </p>
  <div class="grid">
    {tarjetas}
  </div>
  <p style="margin-top:32px;color:#94a3b8;font-size:0.8em">
    Generado por <code>preview_emails.py</code> &nbsp;·&nbsp;
    Los links de aprobación usan un token de prueba y no son funcionales.
  </p>
</body>
</html>"""


def main():
    out_dir = Path(__file__).parent / "email_previews"
    out_dir.mkdir(exist_ok=True)

    index_items = []

    for slug, para, tpl_fn in CORREOS:
        subject, html = tpl_fn()
        num = slug.split("_")[0]

        # Envuelve en página completa con barra de info superior
        pagina = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>{subject}</title>
  <style>
    .info-bar {{
      background:#1e293b;color:#e2e8f0;
      font-family:monospace;font-size:0.8em;
      padding:10px 20px;
      display:flex;gap:24px;flex-wrap:wrap;
      position:sticky;top:0;z-index:99;
    }}
    .info-bar span {{ color:#94a3b8; }}
    .info-bar strong {{ color:#7dd3fc; }}
    .back {{ color:#38bdf8;text-decoration:none;margin-right:16px; }}
    .back:hover {{ text-decoration:underline; }}
    body {{ margin:0;background:#f8fafc; }}
    .email-wrap {{ max-width:680px;margin:30px auto;background:#fff;
                   border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.08);
                   overflow:hidden; }}
  </style>
</head>
<body>
  <div class="info-bar">
    <div>
      <a class="back" href="index.html">← Índice</a>
      <span>Para: </span><strong>{para}</strong>
    </div>
    <div><span>Asunto: </span><strong>{subject}</strong></div>
  </div>
  <div class="email-wrap">
    {html}
  </div>
</body>
</html>"""

        archivo = out_dir / f"{slug}.html"
        archivo.write_text(pagina, encoding="utf-8")
        print(f"  ✓  {slug}.html")

        index_items.append({
            "num": num,
            "archivo": f"{slug}.html",
            "asunto": subject,
            "para": para,
        })

    index_path = out_dir / "index.html"
    index_path.write_text(build_index(index_items), encoding="utf-8")
    print(f"\n  → Índice generado: {index_path}")

    webbrowser.open(index_path.as_uri())
    print("  → Abriendo en el navegador...\n")


if __name__ == "__main__":
    main()
