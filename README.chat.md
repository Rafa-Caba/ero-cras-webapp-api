# README.chat.md

# Chat de Choir App

Este módulo implementa el chat privado y multi-coro utilizado por la aplicación React Native. La identidad, el rol y el coro efectivo siempre se obtienen de la sesión autenticada del servidor.

## Capacidades actuales

- Mensajes de texto.
- Imágenes y fotografías tomadas desde la cámara.
- Videos y documentos.
- Notas de voz.
- Stickers Unicode mediante el tipo `STICKER`.
- Respuestas con referencia `replyTo` al mensaje original.
- Reacciones.
- Estados enviado, entregado y leído.
- Presencia y escritura en tiempo real mediante Socket.IO.
- Aislamiento estricto por `choirId`.
- Uploads administrados por coro y vinculados a `MediaAsset`.

## Endpoints

| Método | Endpoint | Uso |
|---|---|---|
| `GET` | `/api/chat/history` | Historial del coro autenticado. |
| `POST` | `/api/chat` | Crear un mensaje. |
| `PATCH` | `/api/chat/receipts` | Marcar mensajes como entregados o leídos. |
| `PATCH` | `/api/chat/:messageId/reaction` | Agregar, cambiar o retirar una reacción. |
| `POST` | `/api/chat/upload-image` | Subir una imagen del chat. |
| `POST` | `/api/chat/upload-media` | Subir audio o video. |
| `POST` | `/api/chat/upload-file` | Subir un documento. |

## Contrato para crear mensajes

```ts
{
    content: JsonValue;
    type: 'TEXT' | 'IMAGE' | 'FILE' | 'MEDIA' | 'REACTION' | 'AUDIO' | 'VIDEO' | 'STICKER';
    mediaAssetId?: string;
    replyTo?: string;
}
```

`replyTo` guarda el identificador del mensaje original. El API valida que ambos mensajes pertenezcan al mismo coro y devuelve la referencia poblada con su autor para que React Native muestre el preview.

## Socket.IO

El socket recibe únicamente el access token y, para `SUPER_ADMIN`, el coro objetivo explícito. El servidor vuelve a cargar al usuario, valida su sesión y lo incorpora al room:

```text
choir:<choirId>
```

El cliente no puede elegir libremente su identidad, rol ni coro.

## Archivos principales

```text
src/controllers/chat.controller.ts
src/models/ChatMessage.ts
src/routes/chat.ts
src/socket.ts
src/types/socket.types.ts
src/validations/schemas/resource.schemas.ts
```

## Verificación

```bash
npm run typecheck
npm run build
npm run lint
npm test
```
