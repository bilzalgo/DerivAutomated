# G-Squad

G-Squad is a mobile-first Deriv companion built with React, TypeScript, Node.js, Supabase, and Capacitor. The same interface runs in a browser and can be packaged for iOS and Android. Real Deriv quotes are used when configured; account balances and trade statistics are shown only when returned by the connected account or recorded in the database.

## Requirements

- Node.js 20 or newer and npm
- A Supabase project with PostgreSQL and email authentication enabled
- A Deriv developer application for OAuth 2.0 and a Deriv app ID for public market-data WebSockets
- For native builds: Android Studio and Android SDK, or macOS with Xcode for iOS

## Local Development

```sh
npm install
cp .env.example .env
```

Set the environment variables described below. In Supabase, apply `supabase/migrations/202610280001_initial_schema.sql` using the SQL editor or Supabase CLI. Start the frontend and API together:

```sh
npm run dev
```

Open `http://localhost:5173`. The server runs on port 3001. The splash screen is shown once at launch; the app then presents registration or sign-in. Supabase email confirmation may be required by the project's authentication settings.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL used by the API |
| `SUPABASE_ANON_KEY` | Supabase public anon key used by the API to validate user sessions |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only key for user-scoped API operations; never expose to a client |
| `VITE_SUPABASE_URL` | Supabase project URL bundled into the client |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase anon key bundled into the client |
| `DERIV_CLIENT_ID` | OAuth 2.0 client ID registered with Deriv |
| `DERIV_REDIRECT_URI` | Exact callback URL registered with Deriv, e.g. `https://your-app.herokuapp.com/api/deriv/oauth/callback` |
| `DERIV_TOKEN_ENCRYPTION_KEY` | 32-byte base64 key used for AES-256-GCM token encryption; generate with `openssl rand -base64 32` |
| `VITE_DERIV_APP_ID` | Deriv application ID for the public WebSocket market-data stream |
| `VITE_API_URL` | API origin for native builds; leave empty for local browser development and same-origin Heroku deployment |
| `APP_ORIGIN` | Public web-app origin used for OAuth returns and CORS |
| `PORT` | API port; Heroku supplies this automatically |

Never commit `.env` or use a Supabase service-role key in a `VITE_` variable. The OAuth callback and encryption key require HTTPS and managed production secrets when deployed.

## Supabase Setup

1. Create a Supabase project and enable email/password authentication.
2. Apply the migration in `supabase/migrations`.
3. Configure the project's allowed auth redirect URLs for local development and the deployed app.
4. Set the Supabase URL and keys in the environment.

Supabase Auth stores password hashes. The profile trigger assigns a unique `GSQ-` account ID and a Free plan. Row-level security restricts profile, settings, trading, subscription, notification, and operational-log rows by authenticated user. Deriv OAuth states and encrypted credentials are service-role-only.

## Deriv Setup

The implementation follows Deriv's current official documentation:

- [OAuth 2.0 Authorization Code with PKCE](https://developers.deriv.com/docs/intro/oauth/)
- [OAuth authentication and API access](https://developers.deriv.com/docs/intro/authentication/)
- [Deriv Options accounts](https://developers.deriv.com/docs/options/get-accounts/)
- [Active market symbols](https://developers.deriv.com/docs/data/active-symbols/)
- [Live tick stream](https://developers.deriv.com/docs/data/ticks/)

Register the exact backend callback URL with the Deriv OAuth client. The API generates a per-request PKCE verifier/challenge and CSRF state, exchanges the authorization code on the backend, encrypts the access token, and retrieves authorized accounts from `GET https://api.derivws.com/trading/v1/options/accounts`. Users explicitly select Demo or Real. Selecting Real requires confirmation. Public prices use the documented Deriv WebSocket feed and the configured app ID.

For native builds, the OAuth callback returns to `com.gsquad.mobile://oauth`. Register this URL scheme in the iOS URL Types and Android intent filter, and allow it in the Deriv OAuth app configuration where supported. The Capacitor browser plugin opens the system browser; tokens are never returned to the WebView.

## Mobile Builds

```sh
npm run mobile:add:android
npm run mobile:sync
npx cap open android
```

For iOS, run these commands on macOS with Xcode installed:

```sh
npm run mobile:add:ios
npm run mobile:sync
npx cap open ios
```

Set `VITE_API_URL` to the public HTTPS backend origin before `mobile:sync`; Vite embeds client environment variables at build time. Capacitor platform projects and signing credentials must be generated/configured by the release team. The app disables pinch zoom as requested and honors iOS safe-area insets.

## Heroku Deployment

The root `package.json` includes a `heroku-postbuild` script and the `start` command serves the API and built client from one Node process. Configure all server and `VITE_` variables in Heroku Config Vars, apply the Supabase migration, register the HTTPS OAuth callback with Deriv, then deploy the repository. Set `APP_ORIGIN` to the exact HTTPS app origin. Use Heroku-managed TLS and secret config vars; do not put credentials in the repository.

## Checks

```sh
npm test
npm run build
```

## Safety and Unfinished Integrations

- The specified strategy names Bollinger Bands and RSI but supplies no entry rules or thresholds. No rules are invented. The backend `/api/bot/start` endpoint refuses all starts, and no purchase requests are implemented.
- Real-money execution is not implemented or enabled. The current safety lock is deliberate, not a trading simulation.
- Demo order placement, contract proposal validation, duplicate-order recovery, settlement subscriptions, restart recovery, and risk enforcement against open exposure require the owner's strategy specification and controlled testing before implementation.
- Stake limits are validated for basic type/range, but account-specific contract limits are not yet queried. Risk configuration is not represented as a guarantee against losses on already-purchased contracts.
- OAuth account retrieval and token storage are implemented against the documented account endpoint, but this workspace has no Deriv or Supabase credentials; end-to-end authorization, account balances, and mobile deep links still require integration testing with registered applications.
- A native callback URI scheme must be registered in the generated Android/iOS projects and Deriv OAuth settings before native authorization can complete.
- Production migration execution, backup/restore drills, monitoring, and security review remain deployment tasks.