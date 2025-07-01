## Ero Cras - Choral Administration Web Platform

**Ero Cras** is a web application designed to manage liturgical songs, image galleries, choir members, announcements, and user roles with access control (Admin, Editor, Viewer). The system includes a **public version accessible without login** and a **secure admin section** protected with JWT authentication.

---

## 🚀 Technologies Used

### Backend (REST API)
- **Node.js**
- **Express.js**
- **MongoDB** (with mongoose)
- **JWT Authentication** (Access and Refresh Tokens)
- **Zustand** (frontend state management)

### Frontend
- **React.js + TypeScript**
- **Zustand** (global state)
- **React Bootstrap** (UI components)
- **Axios** (with interceptors and refresh tokens)
- **Vite** (bundler)

### Deployment
- **Render** (Backend)
- **Vercel** (Frontend)

---

## 🎓 Features

### 🏠 Public Site (`/`)
- Welcome page with thematic images.
- Inspirational news/messages.
- Public view of songs.
- Public gallery view.

### 🔒 Admin Panel (`/admin`)
- Access protected by secure JWT login.
- Central dashboard with shortcuts to:
  - Users
  - Songs
  - Gallery
  - Members
  - Announcements
  - Group Chat (planned)
- UI adapts based on user role:
  - `admin`: full access
  - `editor`: can create and edit content
  - `viewer`: read-only access

### 🎷 Songs
- Create, edit, and delete songs.
- Categorize by song type.

### 🌍 Gallery
- Upload, edit, and delete images.
- Assign images to specific site positions:
  - Homepage Image
  - Left Menu Image
  - Right Menu Image (top / bottom)

### 👥 Members
- Manage choir member profiles.
- Profile picture and personal info.

### 📊 Announcements
- Post news or inspirational messages.

### 👤 Users (Admin Panel)
- Manage user accounts and roles.
- Defined roles: `admin`, `editor`, `viewer`.
- Secure JWT auth with persistent refresh tokens.

### 🎨 Theme Customization
- Site theme managed via `useThemeStore`:
  - Primary: `#CFAEF9`
  - Secondary: `#EAD4FF`
  - Nav BG: `#F3E3FB`
  - Footer BG: `#b68fe6`
  - Buttons: `#A966FF`

---

## ⚙️ Common Scripts

### API
```bash
npm install
npm start # or npm run dev with nodemon
```

### Frontend
```bash
npm install
npm run dev
```

---

## 🏡 Environment Variables

### Backend (`.env` for Render)
```
PORT=10000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
REFRESH_SECRET=...
```

### Frontend (`.env` for Vercel)
```
VITE_API_URL=https://your-backend-on-render.onrender.com
```

---

## ⛔️ Access Control
- Protected routes require authentication.
- Unauthorized users are redirected.
- Role-based UI using `AuthContext` and `PrivateRoute` in React.

---

## 🚀 Upcoming Features
- Visual theme selector with persistent storage.
- Image preview per site placement.
- Internal group chat and messaging.
- Accessibility improvements and responsive design.

---

## 🌟 Author
**Rafael Cabanillas**

> A project created with passion to support the faith and tech community ✨
