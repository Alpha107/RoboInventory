# RoboInventory v2.0 — PHP Edition

A complete port of the RoboInventory system from Python Flask to **PHP + SQLite**.  
The frontend (HTML/CSS/JS) is identical to the original; only the backend has changed.

---

## Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | PHP 8.1+ (built-in server or Apache/Nginx) |
| Database | SQLite 3 (via PDO) |
| Frontend | Vanilla JS SPA — same as Flask version |
| Auth     | PHP sessions + bcrypt (`password_hash`) |

> **Database compatibility:** PHP uses `password_hash(PASSWORD_BCRYPT)` which produces `$2y$` hashes. Python's bcrypt produces `$2b$` hashes. PHP's `password_verify()` accepts both, so the database is fully portable between the two versions.

---

## Quick Start

### Prerequisites
- PHP 8.1+ with extensions: `pdo`, `pdo_sqlite`, `json`

### Install PHP (Fedora / RHEL)
```bash
sudo dnf install php php-pdo php-json
```

### Install PHP (Ubuntu / Debian)
```bash
sudo apt install php php-sqlite3
```

### Run
```bash
cd PHP/
php -S localhost:8080 index.php
```

Open **http://localhost:8080** in your browser.

---

## Environment Config (`.env`)

```env
ADMIN_USER=admin
ADMIN_PASS=admin123
SECRET_KEY=robotics_inventory_secret_2026
ALLOWED_ORIGINS=http://localhost:8080
```

The app reads `.env` automatically on startup. Change credentials before deploying.

---

## File Structure

```
PHP/
├── index.php          ← Main router + all API handlers (~700 lines)
├── db.php             ← SQLite connection, schema init, inventory helpers
├── .env               ← Environment config (not committed)
├── .htaccess          ← Apache rewrite rules
├── inventory.db       ← SQLite database (auto-created on first request)
│
├── pages/
│   ├── login.html     ← Login page (identical to Flask version)
│   └── dashboard.html ← SPA shell (identical to Flask version)
│
└── static/
    ├── css/style.css  ← All styles
    └── js/
        ├── app.js     ← Core: auth, navigation, Dashboard, Components, Pricing, Purchases
        ├── pages.js   ← Faulty Items, Projects, Packages, Usage Timeline, Schools, Settings
        └── requests.js← Component Requests, User Management, Activity Log
```

---

## Default Accounts

| Full Name          | Username    | Password       | Role  |
|--------------------|-------------|----------------|-------|
| Abashesh Ranabhat  | `abashesh`  | `Abashesh@123` | Admin |
| Surya Bhandari     | `surya`     | `Surya@123`    | Admin |
| *(env-based)*      | `ADMIN_USER`| `ADMIN_PASS`   | Admin |

> Change all passwords after first login via **Settings → Change Password**.

---

## Apache Deployment

Copy the `PHP/` folder to your web root and ensure `mod_rewrite` is enabled:

```bash
sudo a2enmod rewrite
sudo systemctl reload apache2
```

The included `.htaccess` routes all requests through `index.php`.

---

## API Reference

All API endpoints are identical to the Flask version. See the parent project's `README.md` for the full API reference.

Base URL: `http://localhost:8080/api/...`

---

## Security Features

| Feature          | Implementation |
|------------------|---------------|
| Password hashing | `password_hash(PASSWORD_BCRYPT)` — compatible with Python bcrypt |
| Session auth     | PHP sessions, 8-hour lifetime, HttpOnly + SameSite=Lax cookies |
| CSRF protection  | Per-session random token, checked on all mutating requests |
| Login rate limit | Max 10 failed attempts per IP per 5 minutes (temp file–based) |
| Role enforcement | `require_admin()` gate on all admin-only routes |
| XSS prevention   | All user content HTML-escaped by `escHtml()` in JS before DOM insertion |

---

## Developers

| Name              | Role          |
|-------------------|---------------|
| Abashesh Ranabhat | Lead Developer |
| Surya Bhandari    | Co-admin      |
