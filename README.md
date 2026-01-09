# 🎫 IT Support Portal

A clean, self-hosted IT Support and Inventory Management system.

## 📁 Project Structure

- **`/frontend`**: React + Vite (UI)
- **`/backend`**: Node.js + Express + Prisma + SQLite (API & Database)
- **`/docker`**: Deployment configurations

## 🚀 Development Setup (Unified)

From the root folder, you can start both frontend and backend with a single command:

```bash
npm install
npm run dev
```

### Individual folders:
- **`/frontend`**: React + Vite (UI)
- **`/backend`**: Node.js API & Database

## 📦 Docker Deployment

### Local Run (Both Frontend & Backend)
```bash
docker-compose up --build
```
- Access the app at `http://localhost:3000`

### Portainer / Production
Use the configuration in `docker/stack.yml` to deploy as a stack in Portainer.

## ⚙️ Configuration
All settings (Email SMTP, Branding, Offices) are managed directly via the **Admin Dashboard > Settings** once the app is running.

## 📧 Email Notifications
Supports Gmail (App Password) and Office 365 (STARTTLS). Configure these in the browser settings tab.
