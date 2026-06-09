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
