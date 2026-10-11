# CarePoint Hospital Management System

A local full-stack hospital operations app. It uses Node.js 24's built-in HTTP server and SQLite support, so no package installation is needed.

## Start it

On Windows, double-click `Start CarePoint.bat`. It starts the server and opens the browser. Leave the minimized server window running while you use the app.

Alternatively, install Node.js 24 or newer, open a terminal in this folder, run `node server.js`, and visit <http://127.0.0.1:3000>.

The server creates `carepoint.sqlite` in this folder on first launch. That SQLite database stores user accounts, patient records, appointments, departments, beds, inventory, invoices, and audit events. It is retained when you restart the server. Login sessions expire after eight hours and are cleared when the server restarts.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@carepoint.local` | `CarePoint!2026` |
| Doctor | `doctor@carepoint.local` | `Doctor!2026` |
| Staff | `staff@carepoint.local` | `Staff!2026` |

These are local demo credentials. Before sharing or deploying the app, configure `DEMO_PASSWORD` to choose the initial administrator password. The initial accounts are created only when the database has no users.

## Included workflows

- Sign in and sign out with role-aware API access. Passwords use Node's scrypt password hashing; session IDs are random, held in an HttpOnly, SameSite cookie, and expire after eight hours.
- Dashboard counts are read from the database.
- Create and search patient records, including contact details, blood group, allergies, and notes.
- Create appointments, search appointment records, and update appointment status.
- View departments and manage bed availability.
- View inventory and add stock items; low stock is flagged.
- View invoices and update payment status.
- Export appointments as CSV and inspect the administrator audit log.

All included patient records are fictional demo data. This is a local project foundation, not a certified clinical or billing system. Do not put real patient information into it. A production deployment needs HTTPS, secure secret and session storage, database backups, stronger access controls and audit review, privacy/security review, and operational validation for the jurisdiction and clinical setting.
