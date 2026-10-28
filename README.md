# College Event Management System

CampusConnect is a beginner-friendly full-stack website for discovering college events and managing registrations. Students can browse published events, register and cancel registrations. Organizers can create/edit/cancel their own events and view participant lists. Administrators can manage all events and can promote accounts to organizer/admin roles through the Supabase SQL Editor.

## Problem and objectives
College event details often live in scattered notices and group chats. CampusConnect centralizes event information and registration. The MVP demonstrates responsive frontend development, REST APIs, authentication, authorization, relational database design, and Git version control.

## Roles and features
- **Student:** browse/search/filter upcoming events, register, view and cancel registrations.
- **Organizer:** create/edit/cancel own events and view registered participants.
- **Admin:** manage any event and view its participants; role promotion is performed by a trusted project administrator in Supabase.
- Validation, duplicate registration prevention, capacity checks, server-side authorization, rate limiting, security headers, and API error handling.

## Technology stack
HTML5, CSS3, Vanilla JavaScript, Node.js 20+, Express 5, Supabase Auth, Supabase PostgreSQL, Git and GitHub. Google Fonts is used for optional typography; the app's essential functionality does not depend on it.

## Folder structure
```text
college-event-management/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── events.js
│   │   └── registrations.js
│   ├── middleware/
│   │   └── auth.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## Prerequisites
- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js LTS](https://nodejs.org/) (Node 20 or newer) and npm
- [Git](https://git-scm.com/downloads)
- A free [Supabase](https://supabase.com/) account

Check installations in a terminal:
```bash
node --version
npm --version
git --version
```
Node should report v20 or newer. If a command is not found, install the software and restart VS Code.

## Setup from an empty folder

### 1. Create/open the project
Create a folder named `college-event-management`, then open it in VS Code (File → Open Folder). Create the folders and files shown above. Paste each provided source file into its matching path.

### 2. Create a Supabase project
1. Sign in at https://supabase.com/ and create a new project.
2. Save the database password securely; do not add it to this repository.
3. In the project dashboard, open **Project Settings → API** (the exact menu labels may change).
4. Copy the Project URL and a publishable/anon key for `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. Copy the **service_role** secret only into your local backend `.env`. Never put it in frontend files or GitHub.

### 3. Create the database
1. Open **SQL Editor** in the Supabase dashboard.
2. Open local `database/schema.sql`, copy the entire file into a new SQL query, and click **Run**.
3. Confirm that `profiles`, `events`, and `registrations` appear under **Table Editor**.
4. The script also creates timestamp triggers, a new-user profile trigger, and the atomic registration function.

### 4. Configure environment variables
Copy `backend/.env.example` to `backend/.env`, then replace placeholders:
```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ACTUAL_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_ACTUAL_SERVICE_ROLE_SECRET
```
Do not wrap values in quotes unless the value requires them. `.env` contains real local secrets and is ignored by Git. `.env.example` contains only placeholders and should be committed.

### 5. Install packages
Open the VS Code terminal (Terminal → New Terminal). From the project root:
```bash
cd backend
npm install
```
npm creates `package-lock.json` and `node_modules/`. Do not commit `node_modules/`.

### 6. Start the server
From the `backend` directory:
```bash
npm run check
npm run dev
```
Expected startup message: `CampusConnect running at http://localhost:3000`. Open http://localhost:3000 in your browser. Keep the terminal running. Stop the server with Ctrl+C.

For normal startup, use `npm start`.

### 7. Create an organizer
1. Create a normal account through the website and sign in.
2. In Supabase **SQL Editor**, run the following statement, replacing the email with your own account email:
```sql
update public.profiles set role = 'organizer' where email = 'your-account@example.com';
```
3. Log out and log back in so the website refreshes the role. Only a trusted project administrator should run role changes. Never add a public role-editing endpoint.

To make an administrator, run the same statement with `role = 'admin'` for a trusted account. Do not promote users you do not trust.

### 8. Try the main workflows
- Create two student accounts in separate browser sessions if you want to test duplicate registrations.
- Promote one test account to organizer using the SQL above.
- Log in as organizer and create a future-dated event.
- Log in as student, search for the event and register.
- Open **My registrations**, then cancel a registration.
- Log back in as organizer and use **People** to view current registered participants.
- Try an event capacity of 1 and test the full-event message.

## Architecture
Browser pages use `fetch()` to call `/api/...`. Express validates the request and verifies Supabase Auth access tokens. The server then uses its private service-role database client to perform database operations. The service key bypasses RLS, so every private route must enforce authorization before accessing data. RLS is enabled and direct table privileges are revoked from browser roles as defense-in-depth. Do not add browser-side direct database access without redesigning the RLS policies.

## API reference
All responses are JSON unless noted. Protected endpoints require `Authorization: Bearer <Supabase access token>`.

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | API health check | Public |
| POST | `/api/auth/signup` | Create student account | Public; `{fullName,email,password}` |
| POST | `/api/auth/login` | Sign in | Public; `{email,password}` |
| GET | `/api/auth/me` | Current verified profile | Logged-in user |
| GET | `/api/events` | List upcoming published events and counts | Public |
| POST | `/api/events` | Create event | Organizer/admin; event fields in JSON |
| PATCH | `/api/events/:id` | Update event | Owner organizer/admin |
| DELETE | `/api/events/:id` | Cancel event | Owner organizer/admin |
| POST | `/api/events/:id/registrations` | Register current student | Student |
| GET | `/api/registrations/me` | List own registrations | Student |
| DELETE | `/api/registrations/:id` | Cancel own registration | Student |
| GET | `/api/events/:id/registrations` | View event participants | Owner organizer/admin |

Event JSON fields: `title`, `description`, `category`, `venue`, `startsAt`, `endsAt` (ISO date strings), and `capacity` (integer). Event categories are Technical, Cultural, Sports, Workshop, Seminar, and Other. Common status codes: 400 validation error, 401 missing/invalid session, 403 insufficient role/ownership, 404 not found, 409 duplicate/full/closed registration, 429 rate limit, 500 unexpected server error.

## Authentication and security
Supabase Auth hashes and manages passwords; the app never stores raw passwords. API tokens are sent as Bearer tokens and stored in browser localStorage for this educational MVP. XSS can expose localStorage tokens, so keep safe DOM rendering and avoid inserting untrusted HTML. A production deployment should consider secure HttpOnly cookie sessions, CSRF protections, email verification, stronger audit logging, and deployment-specific CORS/security settings. The server-side service key is privileged and must never be exposed to the browser. Rate limiting and Helmet security headers are enabled.

The registration RPC locks an event row while checking capacity so simultaneous requests cannot claim the last seat twice. The unique `(event_id,user_id)` constraint prevents duplicate rows; cancelled registrations can be reactivated.

## Testing checklist
- [ ] `GET http://localhost:3000/api/health` returns `{"status":"ok","service":"college-event-management-api"}`.
- [ ] Homepage loads and event list is retrieved from Supabase.
- [ ] Invalid signup (bad email, short password/name) is rejected.
- [ ] Correct login works; wrong credentials fail.
- [ ] A student cannot create/edit/cancel events or list participants (403).
- [ ] Student can register for a future event with capacity available.
- [ ] Registering twice gives a friendly conflict response.
- [ ] A full event rejects new registrations.
- [ ] Student can see and cancel their own registration.
- [ ] A student cannot cancel another user's registration.
- [ ] Organizer can create/edit/cancel own event and view participants.
- [ ] Organizer cannot edit another organizer's event.
- [ ] Invalid dates, capacity, category and long input are rejected.
- [ ] Empty search results show the empty state; filters work.
- [ ] Test mobile layout using browser developer tools.
- [ ] Expired/invalid token results in a login prompt.

Automated checks: from `backend/`, run `npm run check` for JavaScript syntax. This is not a full integration test; it does not connect to your Supabase project or test browser behavior.

## Troubleshooting
- **Missing environment variable:** verify `backend/.env` exists and each required value is correct, then restart the server.
- **Invalid API key / connection error:** re-copy the Project URL and matching keys from your own Supabase project.
- **No events shown:** create a future event as an organizer; only published events whose end time has not passed are listed.
- **Signup asks for email confirmation:** confirm the email using the Supabase email, then log in. For a classroom demo, configure Supabase Auth email settings appropriately rather than bypassing auth in code.
- **Profile missing:** confirm the SQL schema and `on_auth_user_created` trigger ran successfully.
- **Port already in use:** change `PORT` in `backend/.env`, then visit the matching localhost port.
- **`npm` or `node` not found:** install Node.js LTS and restart VS Code.
- **401/403 responses:** sign in again and check the role in `public.profiles`.

## Git and GitHub
Create an empty repository on https://github.com/ (do not add a README if you already have this one). In a terminal at the project root:
```bash
git init
git status
git add .
git status
git commit -m "Build college event management system"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```
Replace `YOUR_GITHUB_REPOSITORY_URL` with your repository's HTTPS or SSH URL. Confirm the files appear on GitHub. Before committing, make sure `backend/.env`, `node_modules/`, database exports, and personal data are absent. If a secret was ever committed, `.gitignore` alone is not enough: rotate it immediately and remove it from repository history.

## Limitations and future improvements
This MVP does not send emails, provide QR tickets, support payments, or include an admin UI for role changes. Role changes are deliberately restricted to a trusted administrator using Supabase SQL. Potential improvements include email notifications, event poster uploads, attendance check-in, waitlists, calendar export, and a polished dedicated admin dashboard.
