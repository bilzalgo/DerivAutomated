import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptToken, encryptToken, pkcePair } from "./security";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:5173";
const derivClientId = process.env.DERIV_CLIENT_ID;
const derivRedirectUri = process.env.DERIV_REDIRECT_URI;
const admin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;
const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  : null;

declare global {
  namespace Express {
    interface Request { userId?: string }
  }
}

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: [appOrigin, "capacitor://localhost", "https://localhost"], methods: ["GET", "POST", "PUT", "OPTIONS"], allowedHeaders: ["Authorization", "Content-Type"] }));
app.use(express.json({ limit: "32kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));

function requireBackend(_req: Request, res: Response, next: NextFunction) {
  if (!admin || !authClient) return res.status(503).json({ error: "Authentication backend is not configured." });
  next();
}

async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token || !authClient) return res.status(401).json({ error: "Sign in to continue." });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Your session has expired. Sign in again." });
  req.userId = data.user.id;
  next();
}

function protectedRoute(req: Request, res: Response, next: NextFunction) {
  requireBackend(req, res, (error?: unknown) => {
    if (error) return next(error);
    return authenticate(req, res, next);
  });
}

function routeError(res: Response, error: unknown) {
  console.error("Request failed", error instanceof Error ? error.message : "unknown error");
  return res.status(500).json({ error: "The request could not be completed. Try again shortly." });
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    authenticationConfigured: Boolean(admin && authClient),
    derivOAuthConfigured: Boolean(derivClientId && derivRedirectUri && process.env.DERIV_TOKEN_ENCRYPTION_KEY),
  });
});

app.get("/api/me", protectedRoute, async (req, res) => {
  const { data, error } = await admin!.from("profiles").select("id, account_id, full_name, email, account_status, current_plan, joined_at").eq("id", req.userId!).single();
  if (error) return routeError(res, error);
  res.json({ profile: data });
});

const configurationSchema = z.object({
  targetProfit: z.number().finite().positive().max(1_000_000),
  targetLoss: z.number().finite().positive().max(1_000_000),
  stakeAmount: z.number().finite().positive().max(100_000),
  currency: z.string().regex(/^[A-Z]{3,8}$/),
});

app.get("/api/config", protectedRoute, async (req, res) => {
  const { data, error } = await admin!.from("user_configurations").select("target_profit, target_loss, stake_amount, currency, updated_at").eq("user_id", req.userId!).maybeSingle();
  if (error) return routeError(res, error);
  res.json({ configuration: data });
});

app.put("/api/config", protectedRoute, async (req, res) => {
  const parsed = configurationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter valid positive amounts and a supported currency code." });
  const configuration = parsed.data;
  const { data, error } = await admin!.from("user_configurations").upsert({
    user_id: req.userId,
    target_profit: configuration.targetProfit,
    target_loss: configuration.targetLoss,
    stake_amount: configuration.stakeAmount,
    currency: configuration.currency,
    updated_at: new Date().toISOString(),
  }).select("target_profit, target_loss, stake_amount, currency, updated_at").single();
  if (error) return routeError(res, error);
  res.json({ configuration: data });
});

app.post("/api/deriv/oauth/start", protectedRoute, async (req, res) => {
  if (!derivClientId || !derivRedirectUri) return res.status(503).json({ error: "Deriv OAuth is not configured yet." });
  const returnTo = req.body?.client === "mobile" ? "mobile" : "web";
  const { verifier, challenge, state } = pkcePair();
  const { error } = await admin!.from("deriv_oauth_states").insert({
    state,
    user_id: req.userId,
    code_verifier: verifier,
    return_to: returnTo,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) return routeError(res, error);
  const authorize = new URL("https://auth.deriv.com/oauth2/auth");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: derivClientId,
    redirect_uri: derivRedirectUri,
    scope: "trade",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  res.json({ authorizationUrl: authorize.toString() });
});

app.get("/api/deriv/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (typeof state !== "string" || !admin || !derivClientId || !derivRedirectUri) {
    return res.redirect(`${appOrigin}/?deriv=error`);
  }
  const { data: pending, error: lookupError } = await admin.from("deriv_oauth_states").select("user_id, code_verifier, return_to, expires_at").eq("state", state).maybeSingle();
  await admin.from("deriv_oauth_states").delete().eq("state", state);
  if (lookupError || !pending || Date.parse(pending.expires_at) < Date.now()) return res.redirect(`${appOrigin}/?deriv=error`);
  const callbackTarget = pending.return_to === "mobile" ? "com.gsquad.mobile://oauth" : appOrigin;
  if (error || typeof code !== "string") return res.redirect(`${callbackTarget}?deriv=error`);

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: derivClientId,
      redirect_uri: derivRedirectUri,
      code_verifier: pending.code_verifier,
    });
    const response = await fetch("https://auth.deriv.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Deriv token exchange failed");
    const tokens = await response.json() as { access_token?: string; expires_in?: number };
    if (!tokens.access_token) throw new Error("Deriv did not return an access token");

    const encrypted = encryptToken(tokens.access_token);
    const accountsResponse = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!accountsResponse.ok) throw new Error("Could not retrieve Deriv accounts");
    const accountPayload = await accountsResponse.json() as { data?: unknown[]; accounts?: unknown[] };
    const accounts = accountPayload.data ?? accountPayload.accounts ?? [];
    const { error: saveError } = await admin.from("deriv_connections").upsert({
      user_id: pending.user_id,
      status: "connected",
      ...encrypted,
      authorized_accounts: accounts,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (saveError) throw saveError;
    return res.redirect(`${callbackTarget}?deriv=connected`);
  } catch (exchangeError) {
    return res.redirect(`${callbackTarget}?deriv=error`);
  }
});

app.get("/api/deriv/accounts", protectedRoute, async (req, res) => {
  const { data: connection, error } = await admin!.from("deriv_connections").select("token_ciphertext, token_iv, token_tag, selected_account_id, account_mode, status").eq("user_id", req.userId!).maybeSingle();
  if (error) return routeError(res, error);
  if (!connection || connection.status !== "connected") return res.json({ connected: false, accounts: [], selectedAccountId: null, accountMode: null });
  try {
    const token = decryptToken(connection);
    const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401) {
      await admin!.from("deriv_connections").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", req.userId!);
      return res.status(401).json({ error: "Deriv authorization expired. Reconnect your account." });
    }
    if (!response.ok) return res.status(502).json({ error: "Deriv account information is temporarily unavailable." });
    const payload = await response.json() as { data?: unknown[]; accounts?: unknown[] };
    const accounts = payload.data ?? payload.accounts ?? [];
    await admin!.from("deriv_connections").update({ authorized_accounts: accounts, updated_at: new Date().toISOString() }).eq("user_id", req.userId!);
    res.json({ connected: true, accounts, selectedAccountId: connection.selected_account_id, accountMode: connection.account_mode });
  } catch (error) {
    return routeError(res, error);
  }
});

const accountSelectionSchema = z.object({ accountId: z.string().min(1).max(64), mode: z.enum(["demo", "real"]), confirmReal: z.boolean().optional() });
app.post("/api/deriv/accounts/select", protectedRoute, async (req, res) => {
  const parsed = accountSelectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose a valid Deriv account." });
  const selection = parsed.data;
  if (selection.mode === "real" && selection.confirmReal !== true) return res.status(400).json({ error: "Confirm real-money account selection explicitly." });
  const { data: connection, error } = await admin!.from("deriv_connections").select("token_ciphertext, token_iv, token_tag, status").eq("user_id", req.userId!).maybeSingle();
  if (error) return routeError(res, error);
  if (!connection || connection.status !== "connected") return res.status(403).json({ error: "Connect a Deriv account before selecting one." });
  let accounts: Array<Record<string, unknown>>;
  try {
    const token = decryptToken(connection);
    const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401) {
      await admin!.from("deriv_connections").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", req.userId!);
      return res.status(401).json({ error: "Deriv authorization expired. Reconnect your account." });
    }
    if (!response.ok) return res.status(502).json({ error: "Deriv account information is temporarily unavailable." });
    const payload = await response.json() as { data?: unknown[]; accounts?: unknown[] };
    const freshAccounts = payload.data ?? payload.accounts ?? [];
    accounts = Array.isArray(freshAccounts) ? freshAccounts as Array<Record<string, unknown>> : [];
    await admin!.from("deriv_connections").update({ authorized_accounts: accounts, updated_at: new Date().toISOString() }).eq("user_id", req.userId!);
  } catch (error) {
    return routeError(res, error);
  }
  const account = accounts.find((item) => item.account_id === selection.accountId && String(item.account_type).toLowerCase() === selection.mode);
  if (!account) return res.status(403).json({ error: "That account is not available to this authorized Deriv connection." });
  const { error: updateError } = await admin!.from("deriv_connections").update({ selected_account_id: selection.accountId, account_mode: selection.mode, updated_at: new Date().toISOString() }).eq("user_id", req.userId!);
  if (updateError) return routeError(res, updateError);
  if (typeof account.currency === "string") {
    await admin!.from("user_configurations").update({ currency: account.currency }).eq("user_id", req.userId!);
  }
  res.json({ selectedAccountId: selection.accountId, accountMode: selection.mode });
});

app.post("/api/deriv/disconnect", protectedRoute, async (req, res) => {
  const { error } = await admin!.from("deriv_connections").delete().eq("user_id", req.userId!);
  if (error) return routeError(res, error);
  res.json({ disconnected: true });
});

app.get("/api/trades/summary", protectedRoute, async (req, res) => {
  const { data, error } = await admin!.from("trades").select("profit_loss, contract_status").eq("user_id", req.userId!).eq("contract_status", "sold");
  if (error) return routeError(res, error);
  const settled = data ?? [];
  const wins = settled.filter((trade) => Number(trade.profit_loss) > 0).length;
  const losses = settled.filter((trade) => Number(trade.profit_loss) < 0).length;
  const profitLoss = settled.reduce((sum, trade) => sum + Number(trade.profit_loss ?? 0), 0);
  res.json({ settledCount: settled.length, wins, losses, profitLoss, winRate: wins + losses === 0 ? null : wins / (wins + losses) });
});

app.get("/api/bot/status", protectedRoute, async (req, res) => {
  const { data: connection } = await admin!.from("deriv_connections").select("status, selected_account_id, account_mode").eq("user_id", req.userId!).maybeSingle();
  res.json({ status: connection?.selected_account_id ? "Ready" : "Disconnected", executionEnabled: false, reason: "The private MACD strategy is configured. Controlled Demo order, settlement, and risk validation are still required." });
});

app.post("/api/bot/start", protectedRoute, (_req, res) => {
  res.status(409).json({ error: "Trading remains disabled until controlled Demo tests verify order submission, settlement tracking, and backend risk enforcement." });
});

app.post("/api/bot/stop", protectedRoute, (_req, res) => {
  res.json({ status: "Stopped", message: "No trading engine is active. No open contract was canceled." });
});

app.get("/api/notifications", protectedRoute, async (req, res) => {
  const { data, error } = await admin!.from("notifications").select("id, type, message, created_at, read_at").eq("user_id", req.userId!).order("created_at", { ascending: false }).limit(30);
  if (error) return routeError(res, error);
  res.json({ notifications: data ?? [] });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist/client"));
  app.get("*path", (_req, res) => res.sendFile("index.html", { root: "dist/client" }));
}

app.listen(port, "0.0.0.0", () => console.log(`G-Squad API listening on ${port}`));