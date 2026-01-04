# 🚀 Ultimate Guide: Hosting on Coolify (Local/Self-Hosted)

This guide assumes you have zero prior knowledge of Coolify. It will walk you through setting up your own server, installing Coolify, and deploying your Support App entirely responsibly on your own infrastructure.

---

## 🏗️ Phase 1: The Foundation (Server Setup)

Coolify works best on a **Linux Server**. You cannot install it directly on Windows like a normal .exe program.

### Option A: Hosting on your Local Network (Intranet)
If you want this accessible only in your office:
1.  Get a dedicated PC or Laptop.
2.  Install **Ubuntu Server 24.04 LTS** (free).
3.  During installation, enable **OpenSSH Server**.
4.  Once installed, you will have a terminal (black screen). Login with the username/password you created.

### Option B: Hosting on the Cloud (VPS)
If you want to access this from anywhere:
1.  Rent a cheap VPS (e.g., Hetzner, DigitalOcean, Linode).
2.  Choose **Ubuntu 24.04 LTS** as the Operating System.
3.  You will get an IP Address (e.g., `192.168.1.50` or `85.23.xx.xx`).

---

## 📦 Phase 2: Installing Coolify

1.  Open your Windows Terminal (PowerShell) on your main computer.
2.  Connect to your server via SSH:
    ```bash
    ssh username@your-server-ip
    # Enter your password when prompted
    ```
3.  Run the **Automatic Installation Command** (copy-paste this):
    ```bash
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
    ```
4.  Wait (it takes 5-10 minutes).
5.  Once done, it will show you a URL: `http://your-server-ip:8000`.
6.  Open that URL in your browser. Register your **first admin account**. This is your Coolify Dashboard.

---

## 🗄️ Phase 3: Deploying the Database (PocketBase)

1.  In Coolify, Click **+ New Resource**.
2.  Select **Service**.
3.  Search for **PocketBase** and select it.
4.  **Configuration**:
    *   **Name**: `support-db`
    *   **Domains**: `http://db.support.local` (if using local DNS) or just use the IP/Port Coolify assigns (e.g., `http://192.168.1.50:8090`).
    *   *Tip: If exploring locally, you can leave domains empty and just use the IP:Port mapping shown in the "Network" tab.*
5.  Click **Deploy**.
6.  Once green (Running), click the "Open" button (or go to the URL).
7.  **Create your Admin Account** in the PocketBase UI.
8.  **Setup Collections**:
    *   Go to "Collections" -> "New Collection".
    *   Create `tickets` (Add fields: `full_name`, `status`, `description`, etc. - Make sure to set API Rules to "Public" or configured as needed for testing).
    *   Create `inventory`, `settings`, `offices`, `departments`, `users` (add fields as used in the app).
    *   *Alternatively: Import your schema JSON if you have one.*

---

## 🚀 Phase 4: Deploying Your App

**Prerequisite**: Your code must be on a Git provider (GitHub, GitLab, etc.).
1.  Push your current code (locally on `D:\GitHub\Supports`) to a GitHub repository.

**In Coolify:**
1.  Go to **+ New Resource** -> **Project** -> **New Project**.
2.  Select **Production** environment.
3.  Select **Source**: **Public Repository** (easiest if your repo is public) or **GitHub App** (if private).
    *   *If Public*: Paste your GitHub URL (e.g., `https://github.com/YourUser/Supports`).
4.  Coolify will load the repository.
5.  **Build Configuration**:
    *   **Build Pack**: Select **Docker** (It will use the `Dockerfile` in your repo).
    *   **Port**: `5050` (Important! Check "Expose Port" and set this).
6.  **Environment Variables** (Go to the Environment Variables tab):
    *   Add `PORT` = `5050`
    *   Add `VITE_POCKETBASE_URL` = The full URL of your PocketBase (e.g., `http://192.168.1.50:8090`).
        *   *IMPORTANT: Tick the "Build Variable" box for this one! Vite needs it during the build process.*
    *   Add your SMTP details if you want emails (`SMTP_HOST`, `SMTP_REPLY_TO`, etc.).
7.  Click **Deploy**.

---

## ✅ Phase 5: Verification

1.  Wait for the deployment logs to finish.
2.  Click the link provided by Coolify for your application.
3.  You should see your Support Dashboard!
4.  Try logging in with the user you created in PocketBase.

---

## 🔄 Migration (Moving Data)

Since you are now "fully local", you won't use Firebase data. You start fresh.
*   If you *really* need the old data, you must run the migration script locally on your PC *after* PocketBase is running but *before* you switch completely, or just manually re-enter critical data.
