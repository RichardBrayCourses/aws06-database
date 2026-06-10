# AWS 06 Database Setup

This lesson installs the database tools used later in the course:

- Redgate Flyway, for database migrations and versioning
- pgAdmin 4, for working with PostgreSQL databases

Choose the section for your operating system only. Windows users should follow the Windows section. Mac users should follow the Mac section.

## Windows Setup

These instructions use the PowerShell script at:

```powershell
scripts\install-flyway-and-pgadmin-windows.ps1
```

The script installs Flyway and pgAdmin using `winget`.

### Step 1 - check that winget is installed

Open PowerShell and enter:

```powershell
winget --version
```

If this command is not recognised, install **App Installer** from the Microsoft Store, then open a new PowerShell terminal and try again.

### Step 2 - move into the monorepo folder

If your terminal is currently in the `aws06-database` folder, enter:

```powershell
cd .\01-install-flyway-and-pgadmin-scripts\monorepo
```

If your terminal is already in the `01-install-flyway-and-pgadmin-scripts\monorepo` folder, you can skip this step.

### Step 3 - allow local PowerShell scripts to run

PowerShell may block scripts until you allow locally-created scripts for your user account. Run this command in PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

When PowerShell asks for confirmation, enter:

```text
Y
```

This setting applies only to the current Windows user.

### Step 4 - run the installer script

From the `01-install-flyway-and-pgadmin-scripts\monorepo` folder, run:

```powershell
.\scripts\install-flyway-and-pgadmin-windows.ps1
```

If PowerShell still blocks the script, run it with a one-time execution-policy bypass:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-flyway-and-pgadmin-windows.ps1
```

If you have already installed the course Node.js and pnpm tools, you can alternatively run:

```powershell
pnpm run install:windows
```

### Step 5 - check the installation

Open a new PowerShell terminal and check Flyway:

```powershell
flyway -v
```

To check pgAdmin, open the Windows Start menu and search for:

```text
pgAdmin 4
```

## Mac Setup

These instructions use the shell script at:

```bash
scripts/install-flyway-and-pgadmin-macos.sh
```

The script installs Flyway and pgAdmin using Homebrew.

### Step 1 - check that Homebrew is installed

Open Terminal and enter:

```bash
brew --version
```

If this command is not recognised, install Homebrew from:

```text
https://brew.sh/
```

After installing Homebrew, open a new Terminal window before continuing.

### Step 2 - move into the monorepo folder

If your terminal is currently in the `aws06-database` folder, enter:

```bash
cd ./01-install-flyway-and-pgadmin-scripts/monorepo
```

If your terminal is already in the `01-install-flyway-and-pgadmin-scripts/monorepo` folder, you can skip this step.

### Step 3 - run the installer script

From the `01-install-flyway-and-pgadmin-scripts/monorepo` folder, run:

```bash
bash scripts/install-flyway-and-pgadmin-macos.sh
```

If you have already installed the course Node.js and pnpm tools, you can alternatively run:

```bash
pnpm run install:macos
```

### Step 4 - check the installation

Open a new Terminal window and check Flyway:

```bash
flyway -v
```

To check pgAdmin, open it from the Applications folder or run:

```bash
open -a "pgAdmin 4"
```

## What the scripts do

The Windows script:

- confirms it is running on Windows
- confirms `winget` is available
- installs Flyway using the current Redgate Flyway package ID available to `winget`
- installs pgAdmin using the `PostgreSQL.pgAdmin` package ID

The Mac script:

- confirms it is running on macOS
- confirms Homebrew is available
- runs `brew update`
- installs the `flyway` Homebrew formula
- installs the `pgadmin4` Homebrew cask

You do not need to configure a database yet. This step only installs the tools.

## API Endpoint Reference

The deployed API is split into two API Gateway zones:

```text
/public/{proxy+}
  Anonymous access allowed

/auth/{proxy+}
  Cognito authentication required
```

The Express app is mounted behind both zones. The Lambda adapter passes only the proxy part of the path to Express, so deployed `GET /public/health` is handled by the Express `/health` route, and deployed `GET /auth/users/me` is handled by the Express `/users/me` route.

Current endpoints:

```text
GET    /public/health
GET    /public/gallery-photos
POST   /auth/photos/presigned-url
GET    /auth/users/me
PUT    /auth/users/me/nickname
GET    /auth/admin/member
DELETE /auth/admin/photos
```

Protection summary:

```text
Public:
GET /public/health
GET /public/gallery-photos

Any signed-in Cognito user:
POST /auth/photos/presigned-url
GET /auth/users/me
PUT /auth/users/me/nickname

Signed-in Cognito user in the administrators group:
GET /auth/admin/member
DELETE /auth/admin/photos
```

API Gateway rejects unauthenticated calls to `/auth/*` before they reach Lambda. Express then uses `attachAuth` and `requireAuth` as an application-level guard for the protected routes, and `requireGroup("administrators")` adds the administrator-only check for `/auth/admin/*`.

`requireAuth` is not attached to each route individually. It is installed globally in `services/api/src/app.ts`, and the order of the Express middleware is what decides which routes it protects:

```ts
app.use(publicRoutes);
app.use(attachAuth, requireAuth);
app.use("/photos", photoRoutes);
app.use("/users", userRoutes);
app.use("/admin", requireGroup("administrators"), administratorRoutes);
```

That means:

- `publicRoutes` runs before `requireAuth`, so `/health` and `/gallery-photos` remain public.
- `attachAuth` and `requireAuth` run before the protected route groups, so every route mounted after them requires `req.auth`.
- `/photos` and `/users` are available to any signed-in Cognito user.
- `/admin` requires a signed-in Cognito user and the `administrators` Cognito group.

## API Protection Tests

Run the deployed API security checks from the current lesson folder with:

```bash
pnpm run api:test
```

The test script reads the deployed API and Cognito configuration from SSM, creates or reuses test users, obtains Cognito ID tokens, and calls the API through API Gateway.

The latest version checks that:

```text
GET /public/health
  anonymous access succeeds

GET /public/gallery-photos
  anonymous access succeeds

POST /auth/photos/presigned-url
  anonymous access fails
  regular user access reaches request validation

GET /auth/users/me
  anonymous access fails
  regular user access succeeds

GET /auth/admin/member
  anonymous access fails
  regular user access fails
  administrator access succeeds

DELETE /auth/admin/photos
  regular user access fails
```

These are deployed integration checks rather than isolated Express unit tests, so they verify the API Gateway routes, Cognito authorizer, Cognito group claims, Lambda adapter, and Express route protection together.
