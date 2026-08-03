# 🧩 Chat Module (Admin Group Chat)

This module implements a **real-time group chat** system within the Choirs Admin Panel. It allows administrators, editors, and viewers to communicate live using a rich text editor, with support for embedded images, scroll behavior, and activity logging.

---

## ✨ Features

- **Real-time messaging** via WebSocket (`socket.io`)
- **Rich text editing** using TipTap (based on ProseMirror)
- Support for **embedded images**
- **Auto-scroll** to the latest message (even when images load late)
- **User-based alignment** (right for current user, left for others)
- **Live typing and message input animations**
- **User activity logging** when sending a message

---

## 🧠 Technologies Used

### Frontend
- **React + Vite**
- **TipTap Editor** with custom toolbar and image support
- **Zustand** state management (`useChatStore`)
- **Socket.io-client**

### Backend
- **Node.js + Express**
- **Socket.io (server-side)**
- **MongoDB** with Mongoose
- **Cloudinary** for image uploads (via API)
- **Activity log middleware**

---

## 🔌 API Endpoints

| Method | Endpoint         | Description                |
|--------|------------------|----------------------------|
| GET    | `/chat`          | Retrieve chat history      |
| POST   | `/chat`          | Save new message to DB     |
| WS     | `/socket.io`     | Real-time WebSocket server |

---

## 📦 Models

### `ChatMessage`
```ts
{
  contenido: JSONContent,  // TipTap content
  creadoPor: ObjectId,     // Reference to User
  creadoEn: Date,
  tipo: 'texto' | 'imagen',
  imagenUrl?: string,
  imagenPublicId?: string
}
```

---

## ⚙️ .env Variables (Frontend & Backend)

### `.env` (Frontend)
```env
VITE_API_URL=https://chiors-api-production.up.railway.app
```

### `.env` (Backend)
```env
FRONTEND_URL=https://choirs-webapp.vercel.app
CLOUDINARY_URL=...
```

---

## 🚀 Deployment

- **Frontend**: Vercel  
- **Backend + WebSocket**: Railway  
- **Database**: MongoDB Atlas  
- **Images**: Cloudinary

---

## 🧪 Testing

- Run two browser sessions (user A and user B)
- Send message from one → should appear instantly on both
- Add image via TipTap → ensure it uploads and displays correctly
- Check scroll behavior after sending/receiving messages
- Confirm logs are recorded under `/admin/my-profile` or `/admin/logs`

---

## 📁 File Locations

- **Frontend**: `src/components-admin/AdminChat.tsx`
- **Backend**: `routes/chat.js`, `models/ChatMessage.js`
- **Socket Server**: in `server.ts` under `io.on('connection')`

---

## 🧑‍💻 Author
This module was implemented by [Rafael Cabanillas](https://github.com/rafacabanillas) as part of the Ero Cras Project.
