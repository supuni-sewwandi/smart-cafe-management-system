# Bean & Brew — Backend (Phase 1: Database + Auth)

Node.js + Express + MySQL backend. This phase covers:
- Full database schema (all tables for the whole system)
- Customer signup / login / profile (US01.1, US01.2, US01.3)
- Admin & staff login, account management, roles & permissions (US03.11, US03.12)

## 1. Install prerequisites
- Node.js (v18 or newer): https://nodejs.org
- MySQL Server (via XAMPP, MySQL Workbench, or standalone)

## 2. Set up the database
1. Start your MySQL server.
2. Run the schema file to create the database, tables, and seed data:
   ```
   mysql -u root -p < database/schema.sql
   ```
   (Or open `database/schema.sql` in MySQL Workbench / phpMyAdmin and run it there.)

This creates a `bean_and_brew` database with a default admin account already inserted:
- **Email:** admin@beanandbrew.cafe
- **Password:** BnB-Admin#2026

## 3. Configure environment variables
1. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and fill in your MySQL username/password and a random `JWT_SECRET`.

## 4. Install dependencies & run
```
npm install
npm run dev
```
(`npm run dev` uses nodemon to auto-restart on changes. Use `npm start` for a plain run.)

The API starts at `http://localhost:4000` by default. Check it's alive:
```
GET http://localhost:4000/api/health
```

## 5. Available endpoints (Phase 1)

### Customer auth
| Method | Route              | Body                                   | Notes                          |
|--------|--------------------|-----------------------------------------|---------------------------------|
| POST   | /api/auth/signup   | `{ fullName, email, password }`         | Creates account, returns token |
| POST   | /api/auth/login    | `{ email, password }`                   | Returns token                  |
| GET    | /api/auth/me       | — (needs `Authorization: Bearer <token>`) | Current profile              |
| PUT    | /api/auth/me       | `{ fullName, phone, address }`          | Update profile                 |

### Admin / staff auth
| Method | Route                          | Body                                        | Notes                                      |
|--------|--------------------------------|----------------------------------------------|---------------------------------------------|
| POST   | /api/admin/login               | `{ email, password }`                        | Returns token                                |
| GET    | /api/admin/me                  | —                                            | Current admin profile + permissions          |
| GET    | /api/admin/accounts            | —                                            | List all admin/staff accounts (Sys Admin only) |
| POST   | /api/admin/accounts            | `{ fullName, email, password, role }`        | Create account (Sys Admin only)              |
| PATCH  | /api/admin/accounts/:id/status | `{ status: 'active' \| 'inactive' }`         | Activate/deactivate (Sys Admin only)         |
| GET    | /api/admin/permissions         | —                                            | Full role → module matrix                    |
| PUT    | /api/admin/permissions         | `{ updates: [{ role, module, allowed }] }`   | Update matrix (Sys Admin only)               |

All admin routes need `Authorization: Bearer <admin token>` from `/api/admin/login`.

## 6. Connecting this to the existing HTML front-end
Right now `login.html`, `signup.html`, and `admin-login.html` save the session to
`localStorage`/`sessionStorage` directly. To connect them to this real backend,
each of those pages' `<script>` needs to call the API with `fetch` instead, e.g.:

```js
const res = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const data = await res.json();
if (res.ok) {
  localStorage.setItem('bnb-token', data.token);
  localStorage.setItem('bnb-user', data.user.email);
  window.location.href = 'profile.html';
} else {
  // show data.error
}
```

This rewiring (login.html, signup.html, admin-login.html, profile.html, edit-profile.html)
is the next step once you confirm the database + auth API works on your machine.

## 7. What's next (later phases)
- Phase 2: Menu items, cart, orders API (connects menu.html, checkout.html, order-tracking.html)
- Phase 3: Inventory, suppliers, staff, reports API (connects the admin panels)

Only the database schema and auth are wired up so far — the rest of the tables
already exist in `schema.sql` so later phases won't need to change the database
structure, just add new route files.
