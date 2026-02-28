## Installation

To install dependencies:

```sh
bun install
```

## Configuration

### 1. Setup Environment Variables

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

Then configure the following variables in your `.env` file:

#### Authentication & Core

- **BETTER_AUTH_SECRET**: Secret key for Better Auth. Generate a random string (min 32 chars):
  ```sh
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  ```
- **BETTER_AUTH_URL**: Base URL for authentication (e.g., `http://localhost:3000`)
- **NODE_ENV**: Environment mode (`development`, `production`, etc.)

#### Database

- **DATABASE_URL**: PostgreSQL connection string
  ```
  postgres://username:password@localhost:5432/skillarena3
  ```

#### Web Push Notifications (VAPID Keys)

- **VAPID_PUBLIC_KEY**: Public VAPID key for web push notifications
- **VAPID_PRIVATE_KEY**: Private VAPID key for web push notifications

**To generate VAPID keys**, use the `web-push` library:

```sh
npm install -g web-push
web-push generate-vapid-keys
```

Or use Node.js:

```sh
node -e "const vapid = require('web-push').generateVAPIDKeys(); console.log('Public:', vapid.publicKey); console.log('Private:', vapid.privateKey)"
```

Copy the generated keys into your `.env` file.

#### Email Service (SMTP)

Configure these variables to enable email functionality:

- **SMTP_HOST**: SMTP server hostname (e.g., `smtp.gmail.com`)
- **SMTP_PORT**: SMTP server port (typically `587` for TLS or `465` for SSL)
- **SMTP_SECURE**: Set to `true` for port 465 (SSL), `false` for other ports like 587 (TLS)
- **SMTP_USER**: SMTP authentication username/email
- **SMTP_PASSWORD**: SMTP authentication password
- **SMTP_FROM**: Sender email address (e.g., `noreply@example.com`)
- **SMTP_FROM_NAME**: Sender display name (e.g., `Skol`)

### 2. Database Setup

Push schema to PostgreSQL:

```sh
bun run setup:db
```

## Running the Server

Start the development server:

```sh
bun run dev
```

The API will be available at http://localhost:3000
