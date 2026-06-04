"""
Chat AI — DocuFlow Agent
Endpoint de chat con streaming usando Anthropic Claude.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import json

from core.config import settings
from core.auth import get_current_user
from db.models import User

router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM_PROMPT = """Eres DocuFlow Agent AI, el asistente inteligente del sistema de gestión documental y contabilidad DocuFlow de CQ.

Tu función es ayudar a los usuarios con:
- Gestión de facturas: cómo crear, aprobar, rechazar, consultar estado
- Flujo de aprobación: proceso de revisión por radicación, responsable, contabilidad, tesorería y gerencia
- Anticipos y legalización de gastos técnicos
- Gestión de carpetas y centros de costo
- Consultas sobre áreas, unidades de negocio y centros de operación
- Cómo usar las funcionalidades del sistema (filtros, exportación, carga de archivos)
- Resolución de dudas sobre roles y permisos (admin, fact, responsable, contabilidad, tesorería, gerencia, técnico, dirección, user, tarjeta_cq)

Guía de roles:
- admin: acceso total
- fact (radicación): carga y gestión de facturas
- responsable: revisión y aprobación inicial
- contabilidad: revisión contable
- tesoreria/tes: aprobación de pagos
- gerencia: aprobación gerencial de paquetes
- tecnico/mant: legalización de gastos técnicos
- direccion: centro documental
- user: legalización de gastos personales
- tarjeta_cq: gestión de tarjeta CQ

Responde siempre en español, de forma concisa y útil. Si no sabes algo específico del sistema, sé honesto y sugiere contactar al administrador."""


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


async def stream_claude_response(messages: List[ChatMessage]):
    """Genera respuesta en streaming desde Claude."""
    from anthropic import AsyncAnthropic

    if not settings.anthropic_api_key:
        yield f"data: {json.dumps({'error': 'Anthropic API key no configurada'})}\n\n"
        return

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    anthropic_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in messages
        if msg.role in ("user", "assistant")
    ]

    try:
        async with client.messages.stream(
            model="claude-3-5-haiku-20241022",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=anthropic_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'delta': text})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


@router.post("/message")
async def chat_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Endpoint de chat con streaming SSE."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="No hay mensajes en la solicitud")

    return StreamingResponse(
        stream_claude_response(request.messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
