# IT Support & Inventory System

A full-stack IT Support Ticket and Inventory Management system.

## Features
- **Ticket Portal**: Employees can submit Support Issues or Hardware Requests.
- **Admin Dashboard**: Manage tickets, track inventory, and view reports.
- **Inventory System**: Multi-office stock tracking with auto-deduction logic.
- **Email Notifications**: Real email alerts via SMTP (Gmail, Outlook, etc.).
- **Branding**: Customizable logo and company name.

## 🚀 How to Run

Since this is a full-stack application, you need to run both the **Server** (Backend) and **Client** (Frontend).

### Prerequisites
- Install **Node.js** (v18 or higher) from [nodejs.org](https://nodejs.org/).

### 1. Start the Backend (Server)
The server handles the database and emails.

1. Open a terminal/command prompt.
2. Navigate to the `server` folder:
   ```bash
   cd server
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node server.js
   ```
   > The server will start on `http://localhost:3001`.

### 2. Start the Frontend (Client)
The client is the web interface.

1. Open a **new** terminal window.
2. Navigate to the `client` folder:
   ```bash
   cd client
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser and go to the link shown (usually `http://localhost:3000` or `http://localhost:5173`).

## 🔑 Admin Access
- **Login URL**: Click "IT Admin Login" on the home page.
- **Default Password**: `admin123`

## 📧 Email Setup
1. Log in to the Admin Dashboard.
2. Go to **Settings**.
3. Enter your SMTP details (e.g., Gmail App Password).
   - Host: `smtp.gmail.com`
   - User: `your-email@gmail.com`
   - Pass: `your-app-password`
