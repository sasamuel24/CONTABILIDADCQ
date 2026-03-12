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

    async def _send_mail(self, subject: str, body_html: str, to_email: str) -> None:
        """Envía un correo usando la API sendMail de Microsoft Graph."""
        token = await self._get_access_token()
        url = f"{self.GRAPH_BASE}/users/{settings.email_from}/sendMail"
        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": body_html,
                },
                "toRecipients": [
                    {"emailAddress": {"address": to_email}}
                ],
            },
            "saveToSentItems": "true",
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()

    async def enviar_solicitud_aprobacion(self, paquete, token_str: str) -> None:
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
                filas_gastos += (
                    f"<tr>"
                    f"<td style='padding:6px;border:1px solid #ddd'>{g.fecha.strftime('%d/%m/%Y')}</td>"
                    f"<td style='padding:6px;border:1px solid #ddd'>{g.pagado_a}</td>"
                    f"<td style='padding:6px;border:1px solid #ddd'>{g.concepto}</td>"
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
            await self._send_mail(subject, body_html, settings.email_approver)
            logger.info(f"Email de solicitud de aprobación enviado para paquete {folio}")
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
            <p>El siguiente paquete de gastos ha sido aprobado y está listo para enviar a Tesorería.</p>
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


email_service = EmailService()
