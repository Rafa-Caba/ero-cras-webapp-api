<!-- README.chat.md -->

# Choir App Chat

This module implements the private, multi-choir chat used by the React Native application.

The effective user identity, role, and choir are always derived from the server-side authenticated session.

## Current capabilities

- Text messages.
- Images and photos captured with the camera.
- Videos and documents.
- Voice messages.
- Unicode stickers through the `STICKER` message type.
- Replies using a `replyTo` reference to the original message.
- Reactions.
- Sent, delivered, and read states.
- Real-time presence and typing events through Socket.IO.
- Strict isolation by `choirId`.
- Choir-scoped managed uploads linked to `MediaAsset`.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/chat/history` | Returns the authenticated choir's message history. |
| `POST` | `/api/chat` | Creates a message. |
| `PATCH` | `/api/chat/receipts` | Marks messages as delivered or read. |
| `PATCH` | `/api/chat/:messageId/reaction` | Adds, changes, or removes a reaction. |
| `POST` | `/api/chat/upload-image` | Uploads a chat image. |
| `POST` | `/api/chat/upload-media` | Uploads audio or video. |
| `POST` | `/api/chat/upload-file` | Uploads a document. |

## Message creation contract

```ts
{
    content: JsonValue;
    type: 'TEXT' | 'IMAGE' | 'FILE' | 'MEDIA' | 'REACTION' | 'AUDIO' | 'VIDEO' | 'STICKER';
    mediaAssetId?: string;
    replyTo?: string;
}
```

`replyTo` stores the identifier of the original message.

The API validates that both messages belong to the same choir and returns the populated reference, including its author, so React Native can display the reply preview.

## Socket.IO

The socket receives only the access token and, for a `SUPER_ADMIN`, the explicit target choir.

The server reloads the user from the database, validates the session, resolves the effective choir, and joins the socket to:

```text
choir:<choirId>
```

The client cannot freely select its identity, role, or choir.

## Main files

```text
src/controllers/chat.controller.ts
src/models/ChatMessage.ts
src/routes/chat.ts
src/socket.ts
src/types/socket.types.ts
src/validations/schemas/resource.schemas.ts
```

## Verification

```bash
npm run typecheck
npm run build
npm run lint
npm test
```
