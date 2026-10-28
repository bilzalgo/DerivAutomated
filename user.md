Build a modern, responsive, mobile-first automated trading web application named G-SQUAD.
this application will be deployed to heruko platform and host there

and use superbase for all database in this project 

DESIGN:

- Use a light background throughout the entire application.
- Use bright yellow as the primary accent color.
- Use white cards with subtle shadows and rounded corners.
- Use dark charcoal text and gray secondary text.
- Use green for positive trading results and red for negative results.
- Add smooth animations, subtle animated backgrounds, and professional transitions.
- Make the design premium, clean, and easy to use on Android, iPhone, tablets, and desktop computers.

HEADER:

- Left: G-Squad logo and application name.
- Right: Small notification bell and user profile icons.
- Clicking the notification icon opens notifications.
- Clicking the profile icon opens the user's account menu.

BOTTOM NAVIGATION:
Create exactly four primary navigation buttons:

1. Home
2. G-Squad
3. Configure
4. Subscribe

Each button must have an icon and label. Highlight the active page in yellow.

Keep the navigation fixed at the bottom on mobile devices without covering page content.

SPLASH SCREEN:

- Display the G-Squad logo and name.
- Use a light background with animated yellow elements.
- Add a smooth entrance animation and loading indicator.
- Display for 10 seconds during the initial application launch.
- After the splash screen, show Home if the user is authenticated; otherwise, show Login or Register.
- Do not show the splash screen every time the user changes pages.

Create a polished interface, not a generic dashboard template.

Implement a real and secure user authentication system for G-Squad.

REGISTRATION PAGE:

Fields:

- Full Name
- Email Address
- Password

When a user registers:

1. Validate the submitted information.
2. Check that the email is not already registered.
3. Securely hash the password.
4. Create the user account in the database.
5. Automatically generate a unique G-Squad account ID.

Account ID format:
GSQ-9484848483

This is an example format. Generate a unique identifier for every registered user on the backend.

After successful registration, display a success notification and redirect the user to the application.

LOGIN PAGE:

Fields:

- Email Address
- Password

Implement secure login, logout, session management, password reset, and appropriate error messages.

SECURITY:

- Never store plain-text passwords.
- Protect private user data.
- Prevent one user from accessing another user's account.
- Implement appropriate login rate limits.
- Use secure sessions or an equivalent secure authentication mechanism.

Store the following information for each user:

- Internal user ID
- G-Squad account ID
- Full name
- Email
- Password hash
- Join date
- Account status
- Current plan

New users should receive the Free plan by default.

Authentication must be connected to a real backend and database. Do not use frontend-only authentication or fake accounts.
Build the G-Squad Home page with three main cards.

CARD 1: LIVE MARKET TICKER

At the top of the Home page, display a horizontally scrolling market ticker.

Requirements:

- Prices move continuously from right to left.
- Use genuine live market prices from the Deriv API.
- Display supported volatility markets.
- Use a beautiful animated background.
- Use yellow accent elements.
- Display market names and prices clearly.
- Automatically update prices using live market data.
- Handle loading, connection failures, and reconnections.

Do not use fabricated market prices.

CARD 2: LIVE MARKET CHART

Add a market chart card below the ticker.

Display:

- Market symbol.
- Current price.
- Live tick updates.
- A responsive tick-based chart.
- Price labels.
- Loading and error states.

Use a reliable charting library.

The chart is informational. It must not override the bot's fixed trading symbol.

CARD 3: G-SQUAD PROMOTIONAL VIDEO

Add a visually attractive promotional card explaining the G-Squad bot.

Include:

- Animated promotional visuals or a video.
- A short heading.
- A brief description.
- Smooth animation.
- A responsive video container.

Use original or properly licensed media.

Never display fabricated trading results or promise guaranteed profits.

All three cards must follow the light background and yellow accent design system.

Ensure the Home page looks excellent on mobile devices.
Build the G-Squad trading control page.

CARD 1: TRADING STATISTICS

Display these five statistics inside a single card:

1. Deriv Account Balance
2. Profit and Loss (P/L)
3. Wins (W)
4. Losses (L)
5. Win Rate

Use a responsive layout that displays the statistics clearly on mobile devices.

Requirements:

- Retrieve the balance from the connected Deriv account.
- Calculate P/L using actual recorded trade results.
- Count wins and losses from settled contracts.
- Calculate win rate from recorded wins and losses.
- Display whether the selected account is Demo or Real.
- Show appropriate loading and error states.

Never fabricate account balances or trading results.

CARD 2: BOT CONTROLS

Create one card containing:

- START button.
- STOP button.
- Current bot status.

Use yellow for the primary START button and a visually distinct STOP button.

Support these statuses:

- Disconnected
- Ready
- Starting
- Running
- Paused
- Stopping
- Stopped
- Error

When START is pressed, verify authentication, Deriv authorization, account mode, account availability, risk settings, and trading-engine readiness.

When STOP is pressed:

- Prevent new trades from being submitted.
- Cancel pending entry workflows where possible.
- Update the bot status.
- Report the result to the user.

Do not falsely claim that an already purchased contract has been canceled.

Enforce START and STOP controls on the backend, not just in the frontend.

CARD 3: TRADING CONSOLE

Create a full-width, flat console card beneath the bot controls.

Use the same light background style as the rest of the application.

Display timestamped operational messages such as:

- Connecting to Deriv.
- Account connected.
- Market data connected.
- Bot initialized.
- Analyzing market ticks.
- Risk checks passed.
- Valid trade signal detected.
- Requesting proposal.
- Trade submitted.
- Trade settled.
- Target profit reached.
- Target loss reached.
- Connection interrupted.
- Bot stopped.

The console must not reveal the proprietary strategy, indicator parameters, or internal signal formulas.

Include:

- Automatic message updates.
- Scrollable history.
- Auto-scroll to the latest message.
- Clear-console button.
- Connection and error indicators.

Never display passwords, API tokens, or other secrets in the console.

Build a dedicated Configure page for G-Squad.

Page heading:
Configure Your Risk Management

Create a clean interface containing three configuration fields.

FIELD 1: TARGET PROFIT

The profit threshold at which the bot stops initiating new trades.

FIELD 2: TARGET LOSS

The session-loss threshold at which the bot stops initiating new trades.

FIELD 3: STAKE AMOUNT

The amount allocated to each trade.

Add a prominent Save Configuration button.

FUNCTIONAL REQUIREMENTS:

- Validate all values on both the frontend and backend.
- Reject invalid, negative, or unsupported values.
- Respect the selected Deriv account currency.
- Validate stakes against applicable account and contract limits.
- Save configuration in the database.
- Load previously saved values when the user returns.
- Display clear validation and success messages.

RISK ENFORCEMENT:

The backend trading engine must enforce the saved settings before submitting every new trade.

When the configured target profit or target loss is reached:

- Stop initiating new trades.
- Update the bot status.
- Record the reason in the trading console.
- Notify the user.

Use consistent P/L calculations and account for relevant open-trade exposure.

Do not claim that a configured loss limit guarantees an exact maximum loss, because already purchased contracts may still settle at a loss.

The frontend must never be the only component enforcing risk limits.

Build the G-Squad Subscribe page with two cards.

CARD 1: USER PROFILE

Display:

- Full Name
- Email Address
- G-Squad Account ID
- Join Date
- Current Plan

Supported plan labels:

- Free
- VIP

New users must receive the Free plan by default.

Retrieve the displayed profile and plan information from the authenticated user's database record.

Do not hardcode fake profile information.

CARD 2: SUBSCRIPTION

Create a premium-looking subscription card containing:

- Subscription heading.
- Short description.
- Subscription button.

For the current version, clicking the subscription button must display a polished notification:

"Subscriptions Coming Soon"

IMPORTANT:

- Do not implement payment processing.
- Do not collect payment information.
- Do not simulate a successful subscription.
- Do not automatically upgrade users to VIP.

The subscription functionality is a placeholder for a future release.

Maintain the application's light background, yellow accent color, rounded cards, and smooth animations.


Implement a real connection between G-Squad and users' Deriv accounts.

Use Deriv's official supported authorization process, following its current developer documentation.

ACCOUNT CONNECTION FLOW:

1. Add a Connect Deriv Account button.
2. Redirect the user to Deriv's official authorization page.
3. Let the user sign in and approve the requested permissions on Deriv.
4. Receive the authorization response at the registered callback URL.
5. Validate the response on the backend.
6. Complete the required authorization-code exchange securely, using PKCE where required.
7. Establish an authenticated Deriv API connection.
8. Retrieve the accounts accessible to the authorized user.
9. Allow the user to select an eligible Demo or Real account.
10. Display the selected account's connection status and balance.

SECURITY REQUIREMENTS:

- Never ask users to enter their Deriv password inside G-Squad.
- Never expose OAuth client secrets or access tokens in browser code.
- Store sensitive credentials using a secure backend mechanism.
- Encrypt sensitive stored credentials.
- Restrict access to credentials.
- Do not log passwords, tokens, or authorization codes.
- Handle authorization errors and expired sessions.
- Allow users to disconnect their accounts.

ACCOUNT MODE:

Allow users to choose between their available Demo and Real accounts.

When changing accounts:

- Verify that the selected account belongs to the authorized user.
- Confirm the account type.
- Refresh account information.
- Ensure subsequent trading requests use the selected account.
- Safely stop an incompatible active session if necessary.

Never switch users silently from Demo to Real.

Require explicit confirmation before starting real-money trading.

Do not fabricate a successful connection if Deriv authorization has not actually completed.

Before implementation, verify the currently supported OAuth flow, API permissions, account access, and trading capabilities using the official Deriv developer documentation.

Build the actual backend automated trading engine for G-Squad.

FIXED TRADING CONFIGURATION:

- Platform: Deriv.
- Symbol: Volatility 100 (1s) Index.
- Expected API symbol: 1HZ100V, subject to verification.
- Contract type: Rise/Fall.
- Contract duration: 5 ticks.
- Analysis timeframe: Live tick data.
- Indicators: Bollinger Bands and RSI.
- Execution: Automatic when the strategy conditions and risk checks are satisfied.

Do not allow users to select another trading symbol through the interface.

Keep the strategy and its detailed configuration private on the backend.

Do not display indicator parameters, signal formulas, or detailed strategy rules in the user interface.

TRADING PROCESS:

1. Verify that the trading session is active.
2. Verify Deriv authorization.
3. Verify the selected Demo or Real account.
4. Subscribe to the genuine live tick stream.
5. Maintain sufficient tick history for indicator calculations.
6. Validate incoming market data.
7. Evaluate the configured strategy.
8. Check target profit, target loss, stake, and other risk constraints.
9. Request a valid contract proposal.
10. Verify the proposal's symbol, contract type, duration, stake, and price.
11. Submit the purchase request.
12. Confirm whether the purchase succeeded.
13. Record the actual purchased contract.
14. Monitor its status using supported Deriv API operations.
15. Record the actual settlement result.
16. Update P/L, wins, losses, and win rate.
17. Recheck risk limits.
18. Continue only if the session remains authorized and permitted to trade.

STRATEGY REQUIREMENT:

The owner has specified Bollinger Bands and RSI but has not yet specified the exact entry conditions or indicator thresholds.

Do not invent those conditions.

Create a private backend strategy configuration that can be completed according to the owner's strategy specification.

Do not enable real-money order execution until the strategy configuration has been supplied, validated, and tested.

CONTRACT VALIDATION:

Before enabling trading, verify that the selected symbol supports the requested Rise/Fall contract and five-tick duration for the selected account.

If the symbol or contract is unavailable, stop and report the issue. Do not silently substitute another market.

EXECUTION RELIABILITY:

Implement:

- WebSocket connection management.
- Automatic reconnection with bounded retries.
- Timeouts and error handling.
- Duplicate-order prevention.
- Unique trade identifiers.
- Proposal expiration handling.
- Purchase confirmation.
- Contract settlement tracking.
- Recovery after backend restarts.
- Prevention of simultaneous duplicate sessions for the same account.
- Backend-enforced STOP functionality.

Never blindly resubmit a purchase request after a timeout without checking whether the original request succeeded.

Never fabricate trading signals, purchases, contract settlements, or profits.

Implement a modern notification and alert system for G-Squad.

Display toast notifications near the top of the application.

DESIGN:

- Light notification cards.
- Rounded corners.
- Subtle shadows.
- Small colored status indicators.
- Smooth slide-in and fade-out animations.
- Readable text.
- Manual dismissal.
- Automatic dismissal for ordinary notifications.

SUPPORT FOUR TYPES:

- Success
- Information
- Warning
- Error

EXAMPLE NOTIFICATIONS:

- Welcome to G-Squad.
- Account created successfully.
- Deriv account connected.
- Demo account selected.
- Real account selected.
- Bot started.
- Bot stopped.
- Target profit reached.
- Target loss reached.
- Trade settled.
- Connection interrupted.
- Authorization required.
- Subscriptions coming soon.

IMPORTANT:
Notifications about trades must reflect actual backend events.

Do not display a successful-trade notification merely because the user clicked START or because a trade request was submitted.

Distinguish between:

- A signal detected.
- A proposal received.
- A purchase confirmed.
- A contract settled.

Keep critical errors visible until the user acknowledges them when appropriate.

Ensure notifications do not obscure the START or STOP buttons.

Build a secure backend and database for G-Squad.

Use PostgreSQL or another suitable relational database.

DATABASE MODELS:

1. Users

- Internal user ID
- Unique G-Squad account ID
- Full name
- Email
- Password hash
- Join date
- Account status

2. Deriv Connections

- User ID
- Connection status
- Secure credential reference
- Authorized account identifiers
- Selected account
- Account mode
- Authorization metadata

3. User Configurations

- User ID
- Target profit
- Target loss
- Stake amount
- Currency
- Updated timestamp

4. Trading Sessions

- Session ID
- User ID
- Deriv account identifier
- Demo or Real mode
- Start time
- Stop time
- Session status
- Stop reason

5. Trades

- Trade ID
- User ID
- Session ID
- Deriv contract identifier
- Symbol
- Contract type
- Duration
- Stake
- Entry information
- Settlement information
- Actual P/L
- Contract status
- Creation and settlement timestamps

6. Subscriptions

- User ID
- Current plan
- Subscription status
- Relevant timestamps

7. Notifications

- User ID
- Notification type
- Message
- Creation timestamp
- Read status

8. Operational Logs

- Session ID
- Event type
- Sanitized message
- Timestamp

SECURITY:

- Secure authentication and session handling.
- Backend authorization checks.
- Input validation.
- Rate limiting.
- Appropriate CSRF protection.
- Secure CORS configuration.
- Protection against injection attacks.
- Secure secret management.
- Encryption for sensitive stored credentials.
- Database backups.
- Sanitized application logs.
- Audit logging.

Every private database operation must enforce user-level access controls.

A user must never be able to access another user's trading records or control another user's Deriv account.

The backend must independently verify account ownership and authorization.

Never store raw passwords or expose access tokens in browser code.

Implement database migrations and automated tests.

Use a maintainable, production-oriented technology stack for G-Squad.

FRONTEND:

- React
- TypeScript
- Responsive CSS or Tailwind CSS
- Lightweight animations
- Real-time charting library

BACKEND:

- Node.js
- TypeScript
- Fastify or Express
- Secure REST API
- WebSocket support
- Dedicated backend trading engine

DATABASE:

- PostgreSQL
- Suitable database ORM
- Database migrations

INFRASTRUCTURE:

- HTTPS
- Secure environment-variable configuration
- Secret management
- Production logging
- Error monitoring
- Automated tests
- Deployment documentation

ARCHITECTURE REQUIREMENTS:

Separate the frontend, backend, and trading engine sufficiently to protect sensitive information and prevent browser-side manipulation of trades.

Use only documented Deriv API endpoints.

Do not invent API responses or pretend integrations are working when they are not.

PERFORMANCE:

- Optimize for mobile devices.
- Efficiently update live charts.
- Avoid duplicate WebSocket subscriptions.
- Handle network interruptions.
- Prevent memory leaks.
- Keep navigation responsive.
- Avoid animations that interfere with trading operations.

DELIVERABLES:

- Complete frontend source code.
- Complete backend source code.
- Database schema and migrations.
- Environment-variable template.
- Deriv application setup instructions.
- Local development instructions.
- Deployment instructions.
- Automated tests.
- Security notes.
- List of unfinished integrations.

Build the application in stages:

1. UI and navigation.
2. Authentication and database.
3. Deriv authorization.
4. Live market ticker and chart.
5. Trading engine and risk controls.
6. Demo trading and settlement verification.
7. Security testing and controlled Real trading activation.
8. Production deployment.

Do not enable Real trading until authorization, symbol compatibility, strategy configuration, order execution, settlement tracking, and risk enforcement have been tested.

Build G-Squad as a real, functional Deriv automated trading web application.

Follow all previously supplied G-Squad specifications.

The application must include:

- Registration and login.
- Automatically generated G-Squad account IDs.
- Light theme with yellow accents.
- Animated splash screen.
- Header with logo, notifications, and user profile.
- Four bottom navigation buttons: Home, G-Squad, Configure, Subscribe.
- Live market ticker.
- Live market chart.
- Promotional video card.
- Trading statistics card.
- START and STOP controls.
- Trading console.
- Risk configuration page.
- User profile and subscription page.
- Coming Soon subscription notification.
- Genuine Deriv account authorization.
- Demo and Real account selection.
- Fixed Volatility 100 (1s) trading configuration.
- Rise/Fall contracts with five-tick duration.
- Backend strategy using Bollinger Bands and RSI.
- Backend-enforced risk management.
- Real contract execution and settlement tracking.
- Secure database and authentication.
- Responsive mobile interface.
- Production deployment instructions.

Do not change the requested application navigation or invent additional trading modes and strategy choices.

Do not expose the proprietary trading strategy in the user interface.

Do not invent the exact Bollinger Bands and RSI entry rules. Keep the strategy configuration private and require the owner's actual rules before enabling live trading.

Do not fabricate account connections, prices, balances, trades, profits, or trading performance.

Implement actual backend functionality rather than merely creating attractive screens.

Use official Deriv documentation to verify API behavior, permissions, supported symbols, contract types, and authorization requirements.

Prioritize account security, reliable execution, accurate reporting, and risk controls.

The final result should be a polished G-Squad web application that is ready for integration testing and can be deployed after the required credentials, strategy configuration, and production checks are completed.

then use the file name as png use it for the app logo also use it in the splash screen and make sure the app use completely nodejs for the full app and also look nice on any mobile device then also disable the zoom and let all page display to look like a real android and iOS app 
