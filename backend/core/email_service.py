"""Servicio de envío de emails usando Microsoft Graph API (OAuth2 client_credentials)."""
import httpx
from typing import Optional
from core.logging import logger
from core.config import settings


class EmailService:
    """Envía correos electrónicos a través de Microsoft Graph API."""

    GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    async def _get_access_token(self) -> str:
        """Obtiene un access token usando OAuth2 client_credentials."""
        url = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/oauth2/v2.0/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": settings.azure_client_id,
            "client_secret": settings.azure_client_secret,
            "scope": "https://graph.microsoft.com/.default",
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, data=payload)
            resp.raise_for_status()
            return resp.json()["access_token"]

    async def _send_mail(
        self,
        subject: str,
        body_html: str,
        to_email: str,
        attachments: Optional[list] = None,
    ) -> None:
        """Envía un correo usando la API sendMail de Microsoft Graph."""
        import base64
        token = await self._get_access_token()
        url = f"{self.GRAPH_BASE}/users/{settings.email_from}/sendMail"
        message: dict = {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": body_html,
            },
            "toRecipients": [
                {"emailAddress": {"address": to_email}}
            ],
        }
        if attachments:
            message["attachments"] = [
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": att["name"],
                    "contentType": att.get("content_type", "application/pdf"),
                    "contentBytes": base64.b64encode(att["content_bytes"]).decode("utf-8"),
                }
                for att in attachments
            ]
        payload = {"message": message, "saveToSentItems": True}
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()

    async def enviar_solicitud_aprobacion(
        self, paquete, token_str: str, email_override: Optional[str] = None
    ) -> None:
        """
        Envía correo de solicitud de aprobación al aprobador.
        paquete: instancia de PaqueteGasto con gastos cargados.
        """
        try:
            folio = getattr(paquete, "folio", None) or str(paquete.id)[:8]
            nombre_tecnico = paquete.tecnico.nombre if paquete.tecnico else "Técnico"
            semana = paquete.semana
            monto_total = float(paquete.monto_total)
            fecha_inicio = paquete.fecha_inicio.strftime("%d/%m/%Y")
            fecha_fin = paquete.fecha_fin.strftime("%d/%m/%Y")

            # Construir filas de la tabla de gastos
            filas_gastos = ""
            for g in paquete.gastos:
                ca = g.cuenta_auxiliar
                cuenta_str = f"{ca.codigo} — {ca.descripcion}" if ca else "—"
                filas_gastos += (
                    f"<tr>"
                    f"<td style='padding:6px;border:1px solid #ddd'>{g.fecha.strftime('%d/%m/%Y')}</td>"
                    f"<td style='padding:6px;border:1px solid #ddd'>{g.pagado_a}</td>"
                    f"<td style='padding:6px;border:1px solid #ddd'>{g.concepto}</td>"
                    f"<td style='padding:6px;border:1px solid #ddd'>{cuenta_str}</td>"
                    f"<td style='padding:6px;border:1px solid #ddd;text-align:right'>"
                    f"${float(g.valor_pagado):,.2f}</td>"
                    f"</tr>"
                )

            aprobacion_url = f"{settings.frontend_url}/aprobar-paquete?token={token_str}"

            body_html = f"""
            <html><body style="font-family:Arial,sans-serif;color:#333">
            <h2 style="color:#1a3c6e">Solicitud de Aprobación de Gastos</h2>
            <p>Se ha enviado un paquete de gastos para su aprobación.</p>
            <table style="border-collapse:collapse;margin-bottom:16px">
              <tr><td style="padding:4px 12px;font-weight:bold">Folio:</td><td>{folio}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold">Técnico:</td><td>{nombre_tecnico}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold">Semana:</td><td>{semana} ({fecha_inicio} – {fecha_fin})</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold">Monto Total:</td>
                  <td style="font-size:1.1em;font-weight:bold;color:#1a6e3c">${monto_total:,.2f} COP</td></tr>
            </table>

            <h3>Detalle de Gastos</h3>
            <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
              <thead>
                <tr style="background:#1a3c6e;color:#fff">
                  <th style="padding:8px;border:1px solid #ddd">Fecha</th>
                  <th style="padding:8px;border:1px solid #ddd">Pagado a</th>
                  <th style="padding:8px;border:1px solid #ddd">Concepto</th>
                  <th style="padding:8px;border:1px solid #ddd">Cuenta Contable</th>
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

            subject = f"Solicitud de Aprobación - Paquete {folio} - {nombre_tecnico}"
            destinatario = email_override if email_override else settings.email_approver
            await self._send_mail(subject, body_html, destinatario)
            logger.info(f"Email de solicitud de aprobación enviado para paquete {folio} → {destinatario}")
        except Exception as e:
            logger.error(f"Error al enviar email de solicitud de aprobación: {e}")
            # No propagamos el error para no bloquear el workflow principal

    async def enviar_notificacion_aprobado(self, paquete, destinatario_email: str) -> None:
        """
        Envía notificación a Facturación cuando un paquete ha sido aprobado.
        """
        try:
            folio = getattr(paquete, "folio", None) or str(paquete.id)[:8]
            nombre_tecnico = paquete.tecnico.nombre if paquete.tecnico else "Técnico"
            monto_total = float(paquete.monto_total)

            body_html = f"""
            <html><body style="font-family:Arial,sans-serif;color:#333">
            <h2 style="color:#1a6e3c">Paquete de Gastos Aprobado</h2>
            <p>El siguiente paquete de gastos ha sido aprobado y está listo para ser auditado por Facturación.</p>
            <table style="border-collapse:collapse;margin-bottom:16px">
              <tr><td style="padding:4px 12px;font-weight:bold">Folio:</td><td>{folio}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold">Técnico:</td><td>{nombre_tecnico}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold">Semana:</td><td>{paquete.semana}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:bold">Monto Total:</td>
                  <td style="font-size:1.1em;font-weight:bold;color:#1a6e3c">${monto_total:,.2f} COP</td></tr>
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
            await self._send_mail(subject, body_html, destinatario_email)
            logger.info(f"Email de notificación de aprobación enviado para paquete {folio}")
        except Exception as e:
            logger.error(f"Error al enviar email de notificación de aprobado: {e}")
            # No propagamos el error para no bloquear el workflow principal


    async def enviar_notificacion_nuevo_paquete_responsable(self, paquete, email_responsable: str) -> None:
        """
        Avisa al Responsable de Mantenimiento que un técnico envió un paquete para revisión.
        NO incluye link de aprobación — el responsable primero revisa en el sistema
        y luego decide si envía el correo de aprobación al gerente.
        """
        try:
            folio = getattr(paquete, "folio", None) or str(paquete.id)[:8]
            nombre_tecnico = paquete.tecnico.nombre if paquete.tecnico else "Técnico"
            semana = paquete.semana
            fecha_inicio = paquete.fecha_inicio.strftime("%d/%m/%Y")
            fecha_fin = paquete.fecha_fin.strftime("%d/%m/%Y")
            monto_total = float(paquete.monto_total)
            total_gastos = len(paquete.gastos)
            frontend_url = settings.frontend_url

            filas_gastos = ""
            for g in paquete.gastos:
                ca = g.cuenta_auxiliar
                cuenta_str = f"{ca.codigo} — {ca.descripcion}" if ca else "—"
                filas_gastos += (
                    f"<tr>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.fecha.strftime('%d/%m/%Y')}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.pagado_a}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.concepto}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd'>{cuenta_str}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd;text-align:right'>"
                    f"${float(g.valor_pagado):,.2f}</td>"
                    f"</tr>"
                )

            body_html = f"""
            <html><body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
            <div style="background:#1a3c6e;padding:18px 24px;border-radius:6px 6px 0 0">
              <h2 style="color:#fff;margin:0">Paquete de Gastos Pendiente de Revisión</h2>
              <p style="color:#cce0ff;margin:4px 0 0">Sistema de Legalización de Gastos</p>
            </div>
            <div style="border:1px solid #dde;border-top:none;padding:24px;border-radius:0 0 6px 6px">
              <p>El técnico <strong>{nombre_tecnico}</strong> ha enviado un paquete de gastos
                 para su revisión.</p>
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
                  <td style="padding:8px 14px;font-size:1.1em;font-weight:bold;color:#1a3c6e">
                    ${monto_total:,.2f} COP
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
                    <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Cuenta Contable</th>
                    <th style="padding:8px 10px;border:1px solid #ddd;text-align:right">Valor</th>
                  </tr>
                </thead>
                <tbody>{filas_gastos}</tbody>
              </table>

              <p>Ingrese al sistema para revisar el paquete y, si todo está correcto,
                 envíe el correo de aprobación al Gerente desde el botón
                 <em>"Enviar correo de aprobación"</em>.</p>
              <p>
                <a href="{frontend_url}"
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
            await self._send_mail(subject, body_html, email_responsable)
            logger.info(f"Email de aviso enviado al responsable para paquete {folio}")
        except Exception as e:
            logger.error(f"Error al enviar email de aviso al responsable: {e}")

    async def enviar_confirmacion_creacion_paquete(self, paquete, email_tecnico: str) -> None:
        """
        Envía confirmación al técnico cuando crea un nuevo paquete de gastos.
        """
        try:
            folio = getattr(paquete, "folio", None) or str(paquete.id)[:8]
            nombre_tecnico = paquete.tecnico.nombre if paquete.tecnico else "Técnico"
            semana = paquete.semana
            fecha_inicio = paquete.fecha_inicio.strftime("%d/%m/%Y")
            fecha_fin = paquete.fecha_fin.strftime("%d/%m/%Y")
            frontend_url = settings.frontend_url

            body_html = f"""
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
                <a href="{frontend_url}"
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
            await self._send_mail(subject, body_html, email_tecnico)
            logger.info(f"Email de confirmación de creación enviado al técnico para paquete {folio}")
        except Exception as e:
            logger.error(f"Error al enviar email de confirmación de creación: {e}")

    async def enviar_notificacion_paquete_aprobado_tecnico(self, paquete, email_tecnico: str) -> None:
        """
        Notifica al técnico que su paquete fue aprobado y está en proceso de pago.
        """
        try:
            folio = getattr(paquete, "folio", None) or str(paquete.id)[:8]
            nombre_tecnico = paquete.tecnico.nombre if paquete.tecnico else "Técnico"
            semana = paquete.semana
            fecha_inicio = paquete.fecha_inicio.strftime("%d/%m/%Y")
            fecha_fin = paquete.fecha_fin.strftime("%d/%m/%Y")
            monto_total = float(paquete.monto_total)
            frontend_url = settings.frontend_url

            filas_gastos = ""
            for g in paquete.gastos:
                estado_color = "#e8f5e9" if getattr(g, "estado_gasto", "pendiente") != "devuelto" else "#fdecea"
                ca = g.cuenta_auxiliar
                cuenta_str = f"{ca.codigo} — {ca.descripcion}" if ca else "—"
                filas_gastos += (
                    f"<tr style='background:{estado_color}'>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.fecha.strftime('%d/%m/%Y')}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.pagado_a}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd'>{g.concepto}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd'>{cuenta_str}</td>"
                    f"<td style='padding:6px 10px;border:1px solid #ddd;text-align:right'>"
                    f"${float(g.valor_pagado):,.2f}</td>"
                    f"</tr>"
                )

            body_html = f"""
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
                  <td style="padding:8px 14px;font-size:1.1em;font-weight:bold;color:#1a6e3c">
                    ${monto_total:,.2f} COP
                  </td>
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
                    <th style="padding:8px 10px;border:1px solid #ddd;text-align:left">Cuenta Contable</th>
                    <th style="padding:8px 10px;border:1px solid #ddd;text-align:right">Valor</th>
                  </tr>
                </thead>
                <tbody>{filas_gastos}</tbody>
              </table>

              <p>Pronto recibirás una notificación cuando el pago sea procesado.</p>
              <p>
                <a href="{frontend_url}"
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
            await self._send_mail(subject, body_html, email_tecnico)
            logger.info(f"Email de aprobación enviado al técnico para paquete {folio}")
        except Exception as e:
            logger.error(f"Error al enviar email de aprobación al técnico: {e}")

    async def enviar_notificacion_pago_tecnico(self, paquete, email_tecnico: str) -> None:
        """
        Notifica al técnico que su paquete fue pagado y legalizado por Tesorería.
        """
        try:
            folio = getattr(paquete, "folio", None) or str(paquete.id)[:8]
            nombre_tecnico = paquete.tecnico.nombre if paquete.tecnico else "Técnico"
            semana = paquete.semana
            fecha_inicio = paquete.fecha_inicio.strftime("%d/%m/%Y")
            fecha_fin = paquete.fecha_fin.strftime("%d/%m/%Y")
            monto_a_pagar = float(paquete.monto_a_pagar or paquete.monto_total)
            monto_total = float(paquete.monto_total)
            fecha_pago = paquete.fecha_pago.strftime("%d/%m/%Y %H:%M") if paquete.fecha_pago else "—"
            frontend_url = settings.frontend_url

            hay_descuento = monto_a_pagar < monto_total
            fila_descuento = ""
            if hay_descuento:
                descuento = monto_total - monto_a_pagar
                fila_descuento = f"""
                <tr>
                  <td style="padding:8px 14px;font-weight:bold">Descuento por devoluciones:</td>
                  <td style="padding:8px 14px;color:#c0392b">-${descuento:,.2f} COP</td>
                </tr>"""

            body_html = f"""
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
                  <td style="padding:8px 14px">${monto_total:,.2f} COP</td>
                </tr>
                {fila_descuento}
                <tr style="background:#e3f2fd">
                  <td style="padding:8px 14px;font-weight:bold">Monto Pagado:</td>
                  <td style="padding:8px 14px;font-size:1.15em;font-weight:bold;color:#0d47a1">
                    ${monto_a_pagar:,.2f} COP
                  </td>
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
                <a href="{frontend_url}"
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
            await self._send_mail(subject, body_html, email_tecnico)
            logger.info(f"Email de pago enviado al técnico para paquete {folio}")
        except Exception as e:
            logger.error(f"Error al enviar email de pago al técnico: {e}")


    async def enviar_notificacion_paquete_en_tesoreria(
        self,
        paquete,
        email_tesoreria: str,
    ) -> None:
        """
        Notifica al analista de Tesorería que un nuevo paquete llegó para procesar el pago.
        Se dispara cuando Facturación ejecuta 'Enviar a Tesorería'.
        """
        try:
            folio = getattr(paquete, "folio", None) or str(paquete.id)[:8]
            nombre_tecnico = paquete.tecnico.nombre if paquete.tecnico else "Técnico"
            semana = paquete.semana
            fecha_inicio = paquete.fecha_inicio.strftime("%d/%m/%Y")
            fecha_fin = paquete.fecha_fin.strftime("%d/%m/%Y")
            monto_a_pagar = float(paquete.monto_a_pagar or paquete.monto_total)
            monto_total = float(paquete.monto_total)
            frontend_url = settings.frontend_url

            hay_descuento = monto_a_pagar < monto_total
            fila_descuento = ""
            if hay_descuento:
                descuento = monto_total - monto_a_pagar
                fila_descuento = f"""
                <tr>
                  <td style="padding:8px 14px;font-weight:bold">Descuento por devoluciones:</td>
                  <td style="padding:8px 14px;color:#c0392b">-${descuento:,.2f} COP</td>
                </tr>"""

            # Tabla de gastos del paquete
            filas_gastos = ""
            for g in getattr(paquete, "gastos", []):
                estado_gasto = getattr(g, "estado_gasto", "pendiente")
                if estado_gasto == "devuelto":
                    continue
                fecha_g = g.fecha.strftime("%d/%m/%Y") if hasattr(g.fecha, "strftime") else str(g.fecha)
                cuenta = f"{g.cuenta_auxiliar.codigo} — {g.cuenta_auxiliar.descripcion}" if g.cuenta_auxiliar else "—"
                filas_gastos += f"""
                <tr style="border-top:1px solid #eee">
                  <td style="padding:6px 10px">{fecha_g}</td>
                  <td style="padding:6px 10px">{g.pagado_a}</td>
                  <td style="padding:6px 10px">{g.concepto}</td>
                  <td style="padding:6px 10px">{cuenta}</td>
                  <td style="padding:6px 10px;text-align:right">${float(g.valor_pagado):,.2f}</td>
                </tr>"""

            body_html = f"""
            <html><body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
            <div style="background:#0e7490;padding:18px 24px;border-radius:6px 6px 0 0">
              <h2 style="color:#fff;margin:0">&#128176; Nuevo Paquete Pendiente de Pago</h2>
              <p style="color:#cffafe;margin:4px 0 0">Sistema de Legalización de Gastos — Tesorería</p>
            </div>
            <div style="border:1px solid #dde;border-top:none;padding:24px;border-radius:0 0 6px 6px">
              <p>Estimado(a) equipo de <strong>Tesorería</strong>,</p>
              <p>
                Facturación ha enviado un nuevo paquete de gastos que requiere <strong>procesamiento de pago</strong>.
                Por favor ingresar al sistema para revisarlo y registrar el pago correspondiente.
              </p>

              <table style="border-collapse:collapse;margin:16px 0;width:100%">
                <tr style="background:#f0fdfe">
                  <td style="padding:8px 14px;font-weight:bold;width:200px">Folio:</td>
                  <td style="padding:8px 14px">{folio}</td>
                </tr>
                <tr>
                  <td style="padding:8px 14px;font-weight:bold">Técnico:</td>
                  <td style="padding:8px 14px">{nombre_tecnico}</td>
                </tr>
                <tr style="background:#f0fdfe">
                  <td style="padding:8px 14px;font-weight:bold">Semana:</td>
                  <td style="padding:8px 14px">{semana} &nbsp;({fecha_inicio} – {fecha_fin})</td>
                </tr>
                <tr>
                  <td style="padding:8px 14px;font-weight:bold">Monto Total:</td>
                  <td style="padding:8px 14px">${monto_total:,.2f} COP</td>
                </tr>
                {fila_descuento}
                <tr style="background:#ecfdf5">
                  <td style="padding:8px 14px;font-weight:bold;color:#065f46">Monto a Pagar:</td>
                  <td style="padding:8px 14px;font-size:1.1em;font-weight:bold;color:#065f46">${monto_a_pagar:,.2f} COP</td>
                </tr>
              </table>

              <p style="font-weight:bold;margin-top:20px;margin-bottom:8px">Detalle de gastos:</p>
              <table style="border-collapse:collapse;width:100%;font-size:0.88em">
                <thead>
                  <tr style="background:#0e7490;color:#fff">
                    <th style="padding:7px 10px;text-align:left">Fecha</th>
                    <th style="padding:7px 10px;text-align:left">Pagado a</th>
                    <th style="padding:7px 10px;text-align:left">Concepto</th>
                    <th style="padding:7px 10px;text-align:left">Cuenta Contable</th>
                    <th style="padding:7px 10px;text-align:right">Valor</th>
                  </tr>
                </thead>
                <tbody>{filas_gastos}</tbody>
              </table>

              <p style="margin-top:24px">
                <a href="{frontend_url}"
                   style="background:#0e7490;color:#fff;padding:11px 24px;border-radius:5px;
                          text-decoration:none;font-weight:bold;display:inline-block">
                  Ir a Tesorería
                </a>
              </p>
              <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
              <p style="color:#aaa;font-size:0.8em">
                Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
              </p>
            </div>
            </body></html>
            """

            subject = f"[Tesorería] Nuevo paquete para pago — {folio} | {nombre_tecnico} | {semana}"
            await self._send_mail(subject, body_html, email_tesoreria)
            logger.info(f"Notificación de tesorería enviada a {email_tesoreria} para paquete {folio}")
        except Exception as e:
            logger.error(f"Error al enviar notificación de tesorería: {e}")


    async def enviar_solicitud_aprobacion_factura(
        self,
        factura,
        aprobador_nombre: str,
        aprobador_email: str,
        token_str: str,
        comentario: Optional[str] = None,
        pdf_bytes: Optional[bytes] = None,
        pdf_filename: Optional[str] = None,
        solicitante_nombre: Optional[str] = None,
    ) -> None:
        """Envía correo de solicitud de aprobación de factura al gerente seleccionado."""
        try:
            numero = factura.numero_factura
            proveedor = factura.proveedor
            total = float(factura.total)
            fecha_emision = (
                factura.fecha_emision.strftime("%d/%m/%Y")
                if factura.fecha_emision else "—"
            )
            fecha_vencimiento = (
                factura.fecha_vencimiento.strftime("%d/%m/%Y")
                if getattr(factura, "fecha_vencimiento", None) else "—"
            )
            aprobacion_url = f"{settings.frontend_url}/aprobar-factura?token={token_str}"

            # Bloque del solicitante (quien envió la solicitud)
            solicitante_html = ""
            if solicitante_nombre:
                solicitante_html = f"""
                <tr>
                  <td style="padding:8px 14px;font-weight:bold;width:180px">Solicitado por:</td>
                  <td style="padding:8px 14px">{solicitante_nombre}</td>
                </tr>"""

            # Bloque de comentario de trazabilidad (solo si se proporcionó)
            comentario_html = ""
            if comentario and comentario.strip():
                comentario_html = f"""
              <div style="margin:20px 0;padding:14px 18px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px">
                <p style="margin:0 0 4px;font-size:0.85em;font-weight:bold;color:#92400e;text-transform:uppercase;letter-spacing:0.5px">
                  Comentario de trazabilidad
                </p>
                <p style="margin:0;color:#78350f;font-size:0.95em;white-space:pre-wrap">{comentario.strip()}</p>
              </div>"""

            adjunto_html = ""
            if pdf_bytes:
                adjunto_html = """
              <p style="margin:12px 0 0;color:#555;font-size:0.85em">
                &#128206; Se adjunta el PDF de la factura a este correo.
              </p>"""

            body_html = f"""
            <html><body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
            <div style="background:#1a3c6e;padding:18px 24px;border-radius:6px 6px 0 0">
              <h2 style="color:#fff;margin:0">Solicitud de Aprobación de Factura</h2>
              <p style="color:#cce0ff;margin:4px 0 0">Sistema CONTABILIDADCQ</p>
            </div>
            <div style="border:1px solid #dde;border-top:none;padding:24px;border-radius:0 0 6px 6px">
              <p>Estimado(a) <strong>{aprobador_nombre}</strong>,</p>
              <p>Se requiere su aprobación para la siguiente factura:</p>

              <table style="border-collapse:collapse;margin:16px 0;width:100%">
                <tr style="background:#f5f7fa">
                  <td style="padding:8px 14px;font-weight:bold;width:180px">N° Factura:</td>
                  <td style="padding:8px 14px">{numero}</td>
                </tr>
                <tr>
                  <td style="padding:8px 14px;font-weight:bold">Proveedor:</td>
                  <td style="padding:8px 14px">{proveedor}</td>
                </tr>
                <tr style="background:#f5f7fa">
                  <td style="padding:8px 14px;font-weight:bold">Fecha Emisión:</td>
                  <td style="padding:8px 14px">{fecha_emision}</td>
                </tr>
                <tr>
                  <td style="padding:8px 14px;font-weight:bold">Fecha Vencimiento:</td>
                  <td style="padding:8px 14px">{fecha_vencimiento}</td>
                </tr>
                <tr style="background:#f5f7fa">
                  <td style="padding:8px 14px;font-weight:bold">Valor Total:</td>
                  <td style="padding:8px 14px;font-size:1.15em;font-weight:bold;color:#1a3c6e">
                    ${total:,.2f} COP
                  </td>
                </tr>
                {solicitante_html}
              </table>

              {comentario_html}

              <p>Para aprobar esta factura, haga clic en el siguiente botón (válido por <strong>72 horas</strong>):</p>
              <p style="margin:24px 0">
                <a href="{aprobacion_url}"
                   style="background:#1a6e3c;color:#fff;padding:12px 28px;border-radius:5px;
                          text-decoration:none;font-weight:bold;display:inline-block;font-size:1em">
                  &#10003;&nbsp; Aprobar Factura
                </a>
              </p>
              <p style="color:#888;font-size:0.85em">
                Si no puede hacer clic en el botón, copie y pegue este enlace en su navegador:<br>
                <span style="color:#1a3c6e">{aprobacion_url}</span>
              </p>
              {adjunto_html}
              <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
              <p style="color:#aaa;font-size:0.8em">
                Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
              </p>
            </div>
            </body></html>
            """

            attachments = None
            if pdf_bytes and pdf_filename:
                attachments = [{"name": pdf_filename, "content_type": "application/pdf", "content_bytes": pdf_bytes}]

            subject = f"Aprobación Requerida — Factura {numero} | {proveedor}"
            await self._send_mail(subject, body_html, aprobador_email, attachments=attachments)
            logger.info(f"Email de solicitud de aprobación de factura {numero} enviado a {aprobador_email}")
        except Exception as e:
            logger.error(f"Error al enviar solicitud de aprobación de factura: {e}")

    async def enviar_notificacion_factura_aprobada(
        self,
        factura,
        email_responsable: str,
    ) -> None:
        """Notifica al responsable que la factura fue aprobada por el gerente vía email."""
        try:
            numero = factura.numero_factura
            proveedor = factura.proveedor
            total = float(factura.total)
            aprobador_nombre = getattr(factura, "aprobado_por_nombre", None) or "el gerente"

            body_html = f"""
            <html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto">
            <div style="background:#1a6e3c;padding:18px 24px;border-radius:6px 6px 0 0">
              <h2 style="color:#fff;margin:0">&#10003; Factura Aprobada</h2>
              <p style="color:#c8f7dc;margin:4px 0 0">Sistema CONTABILIDADCQ</p>
            </div>
            <div style="border:1px solid #dde;border-top:none;padding:24px;border-radius:0 0 6px 6px">
              <p>La siguiente factura ha sido <strong>aprobada</strong> por {aprobador_nombre}
                 y puede continuar su proceso.</p>
              <table style="border-collapse:collapse;margin:16px 0;width:100%">
                <tr style="background:#f5f7fa">
                  <td style="padding:8px 14px;font-weight:bold;width:180px">N° Factura:</td>
                  <td style="padding:8px 14px">{numero}</td>
                </tr>
                <tr>
                  <td style="padding:8px 14px;font-weight:bold">Proveedor:</td>
                  <td style="padding:8px 14px">{proveedor}</td>
                </tr>
                <tr style="background:#f5f7fa">
                  <td style="padding:8px 14px;font-weight:bold">Valor Total:</td>
                  <td style="padding:8px 14px;font-size:1.1em;font-weight:bold;color:#1a6e3c">
                    ${total:,.2f} COP
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 14px;font-weight:bold">Aprobado por:</td>
                  <td style="padding:8px 14px">{aprobador_nombre}</td>
                </tr>
              </table>
              <p style="margin-top:16px">La factura ha quedado registrada como aprobada en el sistema.</p>
              <hr style="margin-top:30px;border:none;border-top:1px solid #eee">
              <p style="color:#aaa;font-size:0.8em">
                Sistema CONTABILIDADCQ — Este es un correo automático, no responda a este mensaje.
              </p>
            </div>
            </body></html>
            """

            subject = f"Factura Aprobada — {numero} | {proveedor}"
            await self._send_mail(subject, body_html, email_responsable)
            logger.info(f"Notificación de factura aprobada enviada a {email_responsable} para factura {numero}")
        except Exception as e:
            logger.error(f"Error al enviar notificación de factura aprobada: {e}")


email_service = EmailService()
