# RoboInventory v2.0 — PHP Edition

> A full-featured robotics office inventory management system built for internal use.  
> Tracks components, projects, purchases, faulty items, usage, requests and more — all in one place.

**Built by [Abashesh Ranabhat](https://github.com/Alpha107)**  
© 2026 Abashesh Ranabhat. All rights reserved.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Quick Start](#quick-start)
5. [Environment Configuration](#environment-configuration)
6. [File Structure](#file-structure)
7. [Modules & Usage](#modules--usage)
8. [User Roles & Permissions](#user-roles--permissions)
9. [API Reference](#api-reference)
10. [Default Accounts](#default-accounts)
11. [Security](#security)
12. [Deployment](#deployment)
13. [Database](#database)

---

## Overview

RoboInventory v2.0 is a complete rewrite of the original Python/Flask version, ported to **PHP 8.1+ with SQLite**. It is a single-page application (SPA) where all UI is rendered client-side in vanilla JavaScript and all data is served through a lightweight PHP REST API.

The system was built to manage the day-to-day inventory operations of a robotics lab or office — tracking what components exist, where they are being used, what has been purchased, what is faulty, and what team members have requested.

---

## Features

### Inventory Management
- Add, edit, delete components with full stock tracking
- Fields: Total Purchased, Used, Available, Taken for Use, Faulty, Sold, Min Stock, Remarks
- Auto-calculates `Available = Total - Used - Taken - Faulty - Sold`
- Color-coded availability badges (green / yellow / red) based on minimum stock
- CSV export of full inventory
- Duplicate component name detection and merge tool
- Real-time reorder alerts when stock falls below minimum

### Material Purchase (Bill Entry)
- Multi-item bill entry — add multiple components in one purchase session
- Shared date, supplier, invoice number, and notes across all line items
- Auto-fills unit price from Retail Pricing table when a known component is selected
- Live subtotal per row and grand total
- Component name dropdown from existing inventory (prevents naming inconsistencies)
- Date range filter on purchase history
- CSV export of all purchase records

### Retail Pricing
- Maintain a master price list for all materials
- Search and filter pricing records
- Used to auto-fill unit prices in purchase forms

### Projects
- Three-stage project pipeline: **Ongoing → Upcoming → Completed**
- Each project stores: name, description, maker, status, and list of components used
- Admin can add, edit, move status, and delete projects
- Users can view all projects

### Projects Package
- Bundle components + materials into a reusable package/kit
- Track package cost automatically from retail pricing
- Useful for standard robot kits or course bundles

### Usage Timeline
- Log which components were taken out for use and when
- Track who took them (teacher/student name)
- Mark individual components as returned or return all at once
- Full timeline history with dates

### Faulty Items
- Log faulty components with description and date
- Marks components as resolved or unresolved
- Links to specific component names (from inventory dropdown)

### Sold to School
- Track components sold to partner schools
- Log quantity, school name, date, and component
- Keeps main inventory accurate by deducting sold stock

### Requests (Component Request Workflow)
- Users submit component requests with quantity and reason
- Admins see all pending requests and can approve or reject
- Rejected requests require a rejection reason
- Users see status of their own requests only
- Real-time badge count on sidebar for pending requests

### Dashboard
- KPI cards: Total Components, Low Stock Items, Total Value, Active Projects
- Doughnut chart: Component availability breakdown
- Bar chart: Top components by stock
- Activity feed: Recent actions across all modules
- Auto-refresh on navigation

### Admin Tools
- User management: create, edit, delete users; reset passwords
- Activity log: full audit trail of all actions with timestamps and actor
- Settings: change own password, view system info

---

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Backend    | PHP 8.1+ (built-in dev server or Apache/Nginx)    |
| Database   | SQLite 3 via PDO (zero-config, file-based)        |
| Frontend   | Vanilla JS SPA — no frameworks, no build step     |
| Auth       | PHP sessions + bcrypt (`password_hash`)           |
| Fonts      | Lora (serif headings) + Space Grotesk + Inter     |
| Charts     | Chart.js 4.4                                      |

> **Database portability:** PHP uses `$2y$` bcrypt hashes; Python bcrypt uses `$2b$`. PHP's `password_verify()` accepts both, so the database is fully portable between the PHP and Python versions.

---

## Quick Start

### Prerequisites

- PHP 8.1 or higher
- Extensions: `pdo`, `pdo_sqlite`, `json` (usually bundled by default)

### Install PHP

**Fedora / RHEL / CentOS:**
```bash
sudo dnf install php php-pdo php-json
```

**Ubuntu / Debian:**
```bash
sudo apt install php php-sqlite3
```

**macOS (Homebrew):**
```bash
brew install php
```

**Windows:**
Download from [windows.php.net](https://windows.php.net/download/) and ensure `extension=pdo_sqlite` is enabled in `php.ini`.

### Run (Development)

```bash
cd PHP/
php -S localhost:8080 index.php
```

Open **http://localhost:8080** in your browser. The SQLite database (`inventory.db`) is created automatically on first request.

---

## Environment Configuration

Create a `.env` file in the `PHP/` directory (it is git-ignored and never committed):

```env
ADMIN_USER=your_admin_username
ADMIN_PASS=************
SECRET_KEY=************
ALLOWED_ORIGINS=http://localhost:8080
```

| Variable          | Description                                              |
|-------------------|----------------------------------------------------------|
| `ADMIN_USER`      | Bootstrap admin username (created on first run if absent) |
| `ADMIN_PASS`      | Bootstrap admin password — **change before deploying**   |
| `SECRET_KEY`      | Used to seed session security — keep this secret         |
| `ALLOWED_ORIGINS` | CORS allowed origin (set to your production domain)      |

> **Security:** Never commit `.env` to version control. The `.gitignore` already excludes it. Change all default credentials before going live.

---

## File Structure

```
PHP/
├── index.php              ← Main router + all REST API handlers
├── db.php                 ← SQLite connection, schema initialisation, helpers
├── .env                   ← Environment config (git-ignored, never committed)
├── .htaccess              ← Apache URL rewrite rules (routes all to index.php)
├── .gitignore             ← Excludes .env, *.db, tmp files
├── inventory.db           ← SQLite database (auto-created, git-ignored)
├── LICENSE                ← MIT License — Abashesh Ranabhat
│
├── pages/
│   ├── login.html         ← Login page (standalone, own CSS)
│   └── dashboard.html     ← SPA shell — injects all pages via JS
│
└── static/
    ├── css/
    │   └── style.css      ← All application styles (theme: navy blue / Lora serif)
    └── js/
        ├── app.js         ← Core: auth, navigation, Dashboard, Components,
        │                     Pricing, Purchases, Reorder
        ├── pages.js       ← Faulty Items, Projects, Packages, Usage Timeline,
        │                     Sold to School, Settings
        └── requests.js    ← Component Requests, User Management, Activity Log
```

---

## Modules & Usage

### Login
- Visit `http://localhost:8080` — redirects to login if no session
- Select role tab (Admin / User) before signing in
- Wrong role tab shows a clear error rather than granting access

### Dashboard
- Auto-loads on login; shows live KPI summary and charts
- **Low Stock** card links directly to Reorder List
- Activity feed shows the last 20 actions system-wide

### Components (Robotics Inventory)
- **Add Component:** Fill name, quantities, min stock, remarks → Save
- **Edit:** Click pencil icon on any row → update fields inline in modal
- **Delete:** Click bin icon → confirmation required
- **CSV Export:** Downloads full inventory as a spreadsheet
- **Reorder List:** Sidebar badge shows count of low-stock items; clicking shows only those items
- **Duplicate Merge:** Yellow warning appears if same component name is entered twice; merge button consolidates records

### Material Purchase
- **Add Purchase:** Opens multi-item bill form
  - Set date and supplier once (shared across all items)
  - Add rows with `+ Add Item` for each component purchased
  - Type component name — dropdown shows existing names; auto-fills price if found in Retail Pricing
  - Grand total updates live
  - Enter optional invoice number and notes → Save adds all rows at once
- **Edit:** Single-row edit of an existing purchase record
- **Filter by Date:** Use the From / To date pickers to narrow records
- **CSV Export:** Full purchase history

### Retail Pricing
- Maintains a master price list referenced by the purchase form
- Add / edit / delete pricing entries
- Prices auto-populate in purchase form when a matching component name is typed

### Projects
- Three tabs: Ongoing / Upcoming / Completed
- Each project card shows components used, maker name, and description
- **Add Project:** Admin only — fill name, status, maker, description, add components
- **View Details / Edit / Delete:** Available to admin via card action buttons

### Projects Package
- Create a named kit/bundle with a list of materials
- System calculates total cost from the Retail Pricing table
- Useful for standard course kits or recurring builds

### Usage Timeline
- Log when components leave the lab: who took them, when, which components and quantities
- Mark items as returned individually or all at once
- Timeline history shows all past usages with return status

### Faulty Items
- Report a faulty component: name (from inventory dropdown), date, description
- Admin can mark as resolved with a resolution note
- Resolved items remain in log for audit purposes

### Sold to School
- Record components sold to partner schools
- Logs: component name, quantity, school, date, price
- Deducted from main inventory automatically

### Requests
- **Users:** Submit a request for a component with quantity and justification
- **Admins:** View all requests; approve (marks as approved) or reject (requires reason)
- Sidebar badge shows count of pending requests to admin in real time

### Settings
- Change your own password (current password required)
- View system information and session details

### Admin: User Management
- Create new admin or user accounts
- Edit username, full name, role
- Reset any user's password
- Delete user accounts (cannot delete your own)

### Admin: Activity Log
- Full chronological audit trail of all create / update / delete actions
- Shows: timestamp, actor, action type, description
- Read-only; cannot be edited or deleted

---

## User Roles & Permissions

| Action                        | Admin | User |
|-------------------------------|:-----:|:----:|
| View dashboard & inventory    | ✓     | ✓    |
| View projects & usage         | ✓     | ✓    |
| Submit component requests     | ✓     | ✓    |
| Change own password           | ✓     | ✓    |
| Add / edit / delete components| ✓     | ✗    |
| Add / edit / delete purchases | ✓     | ✗    |
| Manage pricing                | ✓     | ✗    |
| Manage projects               | ✓     | ✗    |
| Log faulty / sold items       | ✓     | ✗    |
| Approve / reject requests     | ✓     | ✗    |
| Manage users                  | ✓     | ✗    |
| View activity log             | ✓     | ✗    |
| Merge duplicate components    | ✓     | ✗    |

---

## API Reference

All endpoints are under `/api/`. Authentication is session-based (cookie). Mutating requests (`POST`, `PUT`, `DELETE`) require a valid `X-CSRF-Token` header.

### Auth

| Method | Endpoint              | Auth     | Description                        |
|--------|-----------------------|----------|------------------------------------|
| POST   | `/api/login`          | Public   | Login with `{username, password}`  |
| POST   | `/api/logout`         | Auth     | Destroy session                    |
| GET    | `/api/me`             | Auth     | Returns current user info          |
| POST   | `/api/change-password`| Auth     | Change own password                |

### Dashboard

| Method | Endpoint          | Auth  | Description                      |
|--------|-------------------|-------|----------------------------------|
| GET    | `/api/dashboard`  | Auth  | KPI stats, chart data, activity  |

### Components

| Method | Endpoint                        | Auth  | Description                             |
|--------|---------------------------------|-------|-----------------------------------------|
| GET    | `/api/components`               | Auth  | List all components (optional `?q=`)    |
| POST   | `/api/components`               | Admin | Create component                        |
| PUT    | `/api/components/{id}`          | Admin | Update component                        |
| DELETE | `/api/components/{id}`          | Admin | Delete component                        |
| GET    | `/api/components/reorder`       | Auth  | List components below min stock         |
| POST   | `/api/components/dedup`         | Admin | Merge duplicate component records       |

### Retail Pricing

| Method | Endpoint              | Auth  | Description              |
|--------|-----------------------|-------|--------------------------|
| GET    | `/api/pricing`        | Auth  | List all pricing entries |
| POST   | `/api/pricing`        | Admin | Add pricing entry        |
| PUT    | `/api/pricing/{id}`   | Admin | Update pricing entry     |
| DELETE | `/api/pricing/{id}`   | Admin | Delete pricing entry     |

### Purchases

| Method | Endpoint                | Auth  | Description               |
|--------|-------------------------|-------|---------------------------|
| GET    | `/api/purchases`        | Auth  | List purchases (filterable by `?from=&to=`) |
| POST   | `/api/purchases`        | Admin | Add purchase record       |
| PUT    | `/api/purchases/{id}`   | Admin | Update purchase record    |
| DELETE | `/api/purchases/{id}`   | Admin | Delete purchase record    |
| GET    | `/api/export/purchases` | Admin | Download CSV              |

### Projects

| Method | Endpoint               | Auth  | Description                          |
|--------|------------------------|-------|--------------------------------------|
| GET    | `/api/projects`        | Auth  | List projects (optional `?status=`)  |
| POST   | `/api/projects`        | Admin | Create project                       |
| PUT    | `/api/projects/{id}`   | Admin | Update project                       |
| DELETE | `/api/projects/{id}`   | Admin | Delete project                       |

### Packages

| Method | Endpoint               | Auth  | Description              |
|--------|------------------------|-------|--------------------------|
| GET    | `/api/packages`        | Auth  | List all packages        |
| POST   | `/api/packages`        | Admin | Create package           |
| PUT    | `/api/packages/{id}`   | Admin | Update package           |
| DELETE | `/api/packages/{id}`   | Admin | Delete package           |

### Usage Timeline

| Method | Endpoint                              | Auth  | Description                   |
|--------|---------------------------------------|-------|-------------------------------|
| GET    | `/api/usage`                          | Auth  | List all usage records        |
| POST   | `/api/usage`                          | Auth  | Log new usage                 |
| PUT    | `/api/usage/{id}`                     | Admin | Edit usage record             |
| DELETE | `/api/usage/{id}`                     | Admin | Delete usage record           |
| PUT    | `/api/usage/{id}/return-all`          | Auth  | Mark all components returned  |
| PUT    | `/api/usage/{usageId}/return/{compId}`| Auth  | Mark single component returned|

### Faulty Items

| Method | Endpoint             | Auth  | Description           |
|--------|----------------------|-------|-----------------------|
| GET    | `/api/faulty`        | Auth  | List faulty logs      |
| POST   | `/api/faulty`        | Admin | Add faulty record     |
| PUT    | `/api/faulty/{id}`   | Admin | Update / resolve      |
| DELETE | `/api/faulty/{id}`   | Admin | Delete record         |

### Sold to School

| Method | Endpoint              | Auth  | Description            |
|--------|-----------------------|-------|------------------------|
| GET    | `/api/schools`        | Auth  | List sold records      |
| POST   | `/api/schools`        | Admin | Add sold record        |
| PUT    | `/api/schools/{id}`   | Admin | Update sold record     |
| DELETE | `/api/schools/{id}`   | Admin | Delete sold record     |

### Requests

| Method | Endpoint                       | Auth  | Description                          |
|--------|--------------------------------|-------|--------------------------------------|
| GET    | `/api/requests`                | Auth  | List requests (admin: all; user: own)|
| POST   | `/api/requests`                | Auth  | Submit a request                     |
| PUT    | `/api/requests/{id}/approve`   | Admin | Approve request                      |
| PUT    | `/api/requests/{id}/reject`    | Admin | Reject with reason                   |
| DELETE | `/api/requests/{id}`           | Admin | Delete request                       |

### Users

| Method | Endpoint            | Auth  | Description         |
|--------|---------------------|-------|---------------------|
| GET    | `/api/users`        | Admin | List all users      |
| POST   | `/api/users`        | Admin | Create user         |
| PUT    | `/api/users/{id}`   | Admin | Update user         |
| DELETE | `/api/users/{id}`   | Admin | Delete user         |

### Activity Log

| Method | Endpoint           | Auth  | Description            |
|--------|--------------------|-------|------------------------|
| GET    | `/api/activity`    | Admin | List recent activities |

---

## Default Accounts

> **Passwords are not shown here for security.** Check the `.env` file or ask the system administrator.  
> All passwords should be changed immediately after first login via **Settings → Change Password**.

| Full Name          | Username    | Password   | Role  |
|--------------------|-------------|------------|-------|
| Abashesh Ranabhat  | `abashesh`  | `**********` | Admin |
| Surya Bhandari     | `surya`     | `**********` | Admin |
| *(env bootstrap)*  | `ADMIN_USER`| `**********` | Admin |

---

## Security

| Feature              | Implementation                                                              |
|----------------------|-----------------------------------------------------------------------------|
| Password hashing     | `password_hash(PASSWORD_BCRYPT)` — `$2y$` compatible with Python `$2b$`    |
| Session auth         | PHP sessions, 8-hour lifetime, `HttpOnly` + `SameSite=Lax` cookies          |
| CSRF protection      | Per-session random token, validated on all `POST` / `PUT` / `DELETE` calls  |
| Login rate limiting  | Max 10 failed attempts per IP per 5 minutes (temp file–based counter)       |
| Role enforcement     | `require_admin()` gate checked server-side on every admin-only route        |
| XSS prevention       | All user content passed through `escHtml()` before DOM insertion in JS      |
| `.env` isolation     | Credentials read from environment file, never hard-coded, never committed   |
| SQL injection        | All queries use PDO prepared statements with bound parameters               |

---

## Deployment

### Apache

Copy the `PHP/` folder to your web root (`/var/www/html/` or similar) and enable `mod_rewrite`:

```bash
sudo a2enmod rewrite
sudo systemctl reload apache2
```

The included `.htaccess` routes all requests through `index.php`. Ensure `AllowOverride All` is set for the directory in your Apache config.

### Nginx

Add a location block to your server config:

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}

location ~ \.php$ {
    fastcgi_pass unix:/run/php/php8.1-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
}
```

### Production Checklist

- [ ] Set a strong `ADMIN_PASS` and `SECRET_KEY` in `.env`
- [ ] Change all default account passwords via Settings after first login
- [ ] Set `ALLOWED_ORIGINS` to your actual domain in `.env`
- [ ] Ensure `inventory.db` is not publicly accessible (place outside web root if possible)
- [ ] Enable HTTPS (SSL certificate via Let's Encrypt)
- [ ] Set PHP `display_errors = Off` in production `php.ini`
- [ ] Set file permissions: `chmod 750` on `PHP/` directory, `chmod 640` on `inventory.db`

---

## Database

RoboInventory uses **SQLite 3** via PHP's PDO extension. The database file (`inventory.db`) is created automatically on first request and requires no manual setup.

### Tables

| Table                      | Description                                  |
|----------------------------|----------------------------------------------|
| `users`                    | Admin and user accounts with bcrypt passwords|
| `components`               | Main inventory — all robotics components     |
| `retail_pricing`           | Master price list for materials              |
| `material_purchase`        | Purchase/bill records                        |
| `office_projects`          | Projects (ongoing / upcoming / completed)    |
| `office_project_components`| Components linked to projects                |
| `projects_package`         | Reusable component bundles/kits              |
| `package_materials`        | Materials within a package                   |
| `usage_timeline`           | Component usage/checkout records             |
| `usage_components`         | Components within a usage record             |
| `faulty_log`               | Faulty component reports                     |
| `school_sold`              | Components sold to schools                   |
| `component_requests`       | User requests for components                 |
| `activity_log`             | Full audit trail of all system actions       |
| `rate_limit`               | IP-based login rate limiting counters        |

Schema is initialised automatically in `db.php` using `CREATE TABLE IF NOT EXISTS`.

---

## Developers

| Name               | Role                         | GitHub                                      |
|--------------------|------------------------------|---------------------------------------------|
| Abashesh Ranabhat  | Lead Developer (v1.0 + v2.0) | [Alpha107](https://github.com/Alpha107)     |
