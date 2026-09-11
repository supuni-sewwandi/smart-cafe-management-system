# Bean & Brew — Café System (Frontend + Backend in one project)

This folder has everything in one place now:
- `public/` — all your HTML pages (menu, login, admin panels, everything)
- `server.js`, `routes/`, `middleware/`, `config/` — the backend (Node.js + Express)
- `database/schema.sql` — the MySQL database structure

The backend server serves the HTML pages AND the API from the same address,
so there's no separate "frontend server" vs "backend server" to run — just one.

## 1. Install prerequisites
- Node.js (v18+): https://nodejs.org
- MySQL Server (XAMPP, MySQL Workbench, or standalone)

## 2. Create the database
```
mysql -u root -p < database/schema.sql
```
(Or run `database/schema.sql` in MySQL Workbench / phpMyAdmin.)

This creates the `bean_and_brew` database with a working admin login already inside:
- **Email:** admin@beanandbrew.cafe
- **Password:** BnB-Admin#2026

## 3. Configure your database connection
```
cp .env.example .env
```
Open `.env` and set your MySQL username/password.

## 4. Install dependencies
```
npm install
```

## 5. Run the server
```
npm run dev
```
You should see:
```
Bean & Brew server running at http://localhost:4000
```

## 6. Open the site
Go to **http://localhost:4000/index.html** in your browser.
(Not `file://` and not Live Server anymore — the Node server IS your web server now.)

- Customer site: http://localhost:4000/index.html
- Admin login: http://localhost:4000/admin-login.html

## 7. What's actually connected to the database right now
| Page | Connected to backend? |
|---|---|
| login.html | ✅ Yes — real login via `/api/auth/login` |
| signup.html | ✅ Yes — real signup via `/api/auth/signup` |
| admin-login.html | ✅ Yes — real login via `/api/admin/login` |
| profile.html, edit-profile.html | ⏳ Not yet — still reads/writes localStorage |
| menu.html, checkout.html, order-tracking.html, invoice.html | ⏳ Not yet — still localStorage |
| reservation.html, feedback.html, notifications.html | ⏳ Not yet — still localStorage |
| admin-dashboard.html, inventory.html, suppliers.html, staff.html, system-admin.html, reports.html, menu-items.html | ⏳ Not yet — still localStorage |

So right now: **logging in/signing up is real** (checked against MySQL), but once
you're logged in, the rest of the site (menu, cart, orders, admin panels) still
runs on the browser's localStorage, same as before. That's the next phase —
wiring each of those pages to their own API routes (which don't exist yet;
only `routes/auth.js` and `routes/adminAuth.js` exist so far).

## 8. Troubleshooting
- **"Could not reach the server"** on login/signup → the Node server isn't running, or you opened the HTML file directly (`file://...`) instead of through `http://localhost:4000/...`.
- **Login says "Incorrect email or password"** even with the right admin password → check you ran `database/schema.sql` (it inserts the default admin row) and that `.env` points to the right database.
- **"Access denied for user..." when running schema.sql** → your MySQL username/password in the command doesn't match; adjust the `mysql -u root -p` command to your actual MySQL username.
