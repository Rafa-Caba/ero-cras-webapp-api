<!-- README.md -->

# Choir App — Stickers, Replies, Composer, and Gallery Settings Fix

This package contains only the new or modified files required to fix the issues documented in the QA PDF and address the secondary technical observations found in the current repositories.

It does not include complete repositories, automatic patch scripts, or the upcoming multimedia storage phase.

## Included results

### 1. Stickers could not be sent

The main cause was found in the current API:

- `src/models/Choir.ts` had accidentally been replaced with the contents of the `ChatMessage` model.
- `src/models/ChatMessage.ts` still contained an older version without `STICKER`, `deliveredTo`, or `readBy`.
- This left the MongoDB model, validation layer, and React Native contract misaligned.

The fix:

- restores the actual `Choir` model;
- places the updated model in `ChatMessage.ts`;
- keeps `STICKER` as a valid message type;
- preserves delivered and read receipts;
- adds regression tests to prevent `Choir.ts` from accidentally registering the `ChatMessage` model again.

The initial sticker panel is also replaced with a strongly typed and extensible structure containing four packs:

```text
Expresiones
Fe
Música
Comunidad
```

The packs use Unicode characters and do not add external assets, additional licenses, or native dependencies. They can be expanded from:

```text
choir-app/src/constants/chatStickers.ts
```

### 2. Replies lost the original message reference

The preview was visible while composing a reply, but the `replyTo` identifier could be lost before the mutation built the final payload.

Now:

- `ChatInput` explicitly captures and sends `replyToId` with text, images, files, audio, and stickers;
- the selected reply is cleared only after the message is created successfully;
- when sending fails, the original message remains selected so the user can retry;
- the API stores `replyTo` as a reference to the original message and validates that both messages belong to the same choir;
- API and Socket.IO responses include the populated original message and its author;
- the sent message bubble preserves a visible block containing the original author and message preview;
- photos, videos, audio messages, files, and stickers show descriptive previews even when they do not contain text.

The reply preview is pressable. When it is pressed:

1. the original message is located within the loaded history;
2. the list scrolls to its position;
3. the original message is highlighted temporarily.

The chat currently loads the 50 most recent messages. When a reply points to an older message that has not been loaded, the app displays an alert instead of scrolling to an incorrect position.

### 3. Composer remained elevated after hiding the keyboard

The mechanism that measures the real iOS keyboard frame remains in place because it previously fixed the composer being hidden behind the keyboard.

The issue was that the calculated shift could remain stored after the keyboard closed or after the reply preview changed the composer height.

Now:

- both `keyboardWillHide` and `keyboardDidHide` are monitored on iOS;
- a final keyboard frame with zero height or outside the visible screen is also detected;
- keyboard visibility is tracked explicitly;
- leaving or blurring the screen resets the composer shift;
- a delayed measurement cannot restore the offset of a keyboard that has already closed;
- reply preview height changes are recalculated only while the keyboard is visible;
- the list bottom padding uses only the real overlap, avoiding duplicated composer space.

The composer remains attached to the keyboard while it is open and returns to the bottom of the screen when the keyboard closes.

### 4. Switches were clipped in Image Settings

The gallery settings modal now:

- respects the bottom safe area;
- uses additional horizontal padding;
- reserves a fixed-width area for every switch;
- adds internal right spacing;
- slightly scales the native switch to prevent iOS from clipping its right edge;
- preserves vertical scrolling when the content does not fit.

### 5. Secondary technical observations

The package also includes the secondary corrections identified during the initial repository review:

- `.env.testflight.example` fixes `https://https://` and the `chiors` typo.
- `README.chat.md` now documents the current private, multi-choir chat instead of the previous web-oriented flow.
- Legacy `any` usage was removed from the touched TipTap, settings, and user normalization files.
- Explicit TipTap contracts were added to React Native and the API.
- Every new or modified source file keeps its path in the first line.

## React Native files to add or replace

```text
choir-app/.env.testflight.example
choir-app/scripts/production-regressions.test.mjs
choir-app/src/components/chatMessages/ChatInput.tsx
choir-app/src/components/chatMessages/ChatMessageItem.tsx
choir-app/src/components/song/TipTapViewer.tsx
choir-app/src/constants/chatStickers.ts
choir-app/src/hooks/query/useChatData.ts
choir-app/src/screens/chat/ChatScreen.tsx
choir-app/src/screens/gallery/MediaDetailScreen.tsx
choir-app/src/screens/settings/AdminSettingsScreen.tsx
choir-app/src/screens/settings/profile/ProfileScreen.tsx
choir-app/src/types/chat.ts
choir-app/src/types/settings.ts
choir-app/src/types/tiptap.ts
choir-app/src/utils/normalizeChatMessage.ts
choir-app/src/utils/tiptapUtils.ts
```

New files:

```text
choir-app/src/constants/chatStickers.ts
choir-app/src/types/tiptap.ts
```

## API files to add or replace

```text
choirs-api/README.chat.md
choirs-api/scripts/production-regressions.test.mjs
choirs-api/src/models/ChatMessage.ts
choirs-api/src/models/Choir.ts
choirs-api/src/types/tiptap.types.ts
choirs-api/src/utils/extractTextFromTiptap.ts
choirs-api/src/utils/normalizeUser.ts
choirs-api/src/utils/populateHelpers.ts
```

New file:

```text
choirs-api/src/types/tiptap.types.ts
```

There are no files to delete.

The following files are not modified:

```text
package.json
package-lock.json
app.config.ts
eas.json
.github/workflows/eas-update-production.yml
```

## Application order

### 1. Apply the API changes first

Copy the contents of the package's `choirs-api` folder into the root of the `choirs-api` repository.

Then run:

```bash
npm install
npm run typecheck
npm run build
npm run lint
npm test

git status
git add .
git commit -m "fix: restore choir model and stabilize chat replies"
git push
```

Wait for Railway to complete the deployment successfully before publishing the React Native update.

### 2. Apply the React Native changes

Copy the contents of the package's `choir-app` folder into the root of the `choir-app` repository.

Then run:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run verify:phase-17-18
npx expo-doctor

git status
git add .
git commit -m "fix: stabilize chat replies stickers and media settings"
git push
```

## OTA publication through GitHub Actions

This package does not add native modules or change the runtime.

After confirming the API deployment and completing the local validation commands, use the existing workflow:

```text
GitHub
→ choir-app
→ Actions
→ EAS Update Production
→ Run workflow
```

Suggested update message:

```text
fix: stabilize chat replies stickers and media settings
```

The update can be published through the `production` channel to binaries compatible with runtime `1.0.4`, including the current TestFlight build 2 and the compatible APK.

A new native build is not required only for this package.

## Optional API validation with `curl` and `jq`

Define temporary values:

```bash
export API_URL="https://choirs-api-production.up.railway.app/api"
export ACCESS_TOKEN="YOUR_ACCESS_TOKEN"
export TARGET_CHOIR_ID="YOUR_CHOIR_ID"
```

For a regular choir user, the `x-target-choir-id` header can be removed. For a `SUPER_ADMIN`, keep the explicit target choir.

### Send a sticker

```bash
STICKER_RESPONSE=$(curl -sS \
  -X POST "$API_URL/chat" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-target-choir-id: $TARGET_CHOIR_ID" \
  -H "Content-Type: application/json" \
  -d '{"content":"🙏","type":"STICKER"}')

echo "$STICKER_RESPONSE" | jq
```

The expected response is `201` with:

```text
message.type = STICKER
message.content = 🙏
```

### Send a reply

First, obtain the ID of an existing message:

```bash
export ORIGINAL_MESSAGE_ID="MESSAGE_ID"
```

Then send:

```bash
curl -sS \
  -X POST "$API_URL/chat" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-target-choir-id: $TARGET_CHOIR_ID" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"Test reply\",\"type\":\"TEXT\",\"replyTo\":\"$ORIGINAL_MESSAGE_ID\"}" \
  | jq
```

The expected response is `201`, and `message.replyTo` must contain the populated original message instead of disappearing after the reply is sent.

## Functional checklist on iPhone

### Stickers

1. Open Chat.
2. Press the sticker icon.
3. Switch between **Expresiones**, **Fe**, **Música**, and **Comunidad**.
4. Send at least one sticker from every pack.
5. Confirm that “No fue posible enviar el sticker” no longer appears.
6. Close and reopen the chat.
7. Confirm that the stickers remain in the message history.

### Replies

1. Press and hold a message.
2. Select **Responder**.
3. Confirm that the preview appears above the composer.
4. Write and send the reply.
5. Confirm that the sent bubble preserves the original author and message preview.
6. Close and reopen the chat.
7. Confirm that the preview remains visible.
8. Press the preview inside the sent bubble.
9. Confirm that the list scrolls to the original message and highlights it.
10. Repeat the test with text, photo, audio, file, and sticker messages.

### Keyboard and composer

1. Select **Responder**.
2. Open the keyboard.
3. Confirm that the composer remains attached to the top edge of the keyboard.
4. Write multiple lines.
5. Hide the keyboard by pressing or dragging the conversation.
6. Confirm that the composer returns completely to the bottom.
7. Send another reply and repeat several times to confirm that no offset accumulates.

### Image settings

1. Open an image from Gallery.
2. Press the settings icon.
3. Confirm that every switch is fully visible, including its right edge.
4. Toggle every option and confirm that the switches are not clipped.
5. Repeat using the device's usual orientation and text size.

## Validation completed in this environment

The following commands passed:

```text
RN: npm run lint
RN: npm test
API: npm run lint
API: npm test
```

Results:

```text
Phase 14-16 RN contract tests passed.
Phase 17-18 RN contract tests passed.
Production and performance regression contract tests passed.

Phase 14-16 API contract tests passed.
Phase 17-18 API contract tests passed.
Production and performance regression API contract tests passed.
```

The following checks were also completed:

- TypeScript and TSX syntax parsing for the 20 modified source files;
- verification of the file path in the first line;
- verification that the touched source files do not add `any`, `as any`, `unknown`, or `@ts-ignore`;
- a regression test preventing `Choir.ts` from registering `ChatMessage`;
- verification of the explicit `replyToId` payload and pressable reply preview.

It was not possible to run `npm install`, `npm run typecheck`, or the complete build inside the isolated environment because the available registry does not contain every locked project dependency, including `zustand@4.5.7`.

Run the complete validation on the development machine before committing.

## Outside this package

The following items remain separated for the next agreed phase:

- local downloading of images, videos, audio, and documents;
- **Guardar en Fotos**;
- **Abrir con… / Guardar en Archivos / Compartir**;
- multimedia caching and offline use;
- **Ajustes → Multimedia y almacenamiento**;
- automatic download and cache cleanup policies.
