import { useEffect, useMemo, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check, ChevronDown, CircleHelp,
  Clock3, Headphones, Home, LogOut, Menu, Play, Plus, Radio, Settings2, ShieldCheck,
  Sparkles, Square, UserRound, Wallet, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "./lib/api";
import { supabase, supabaseConfigured } from "./lib/supabase";
import logoUrl from "../../6819650.png";

type Tab = "Home" | "G-Squad" | "Configure" | "Subscribe";
type Toast = { id: number; kind: "success" | "information" | "warning" | "error"; message: string };
type Tick = { epoch: number; quote: number };
type Market = { symbol: string; display_name: string; market: string; submarket: string };
type DerivAccount = { account_id: string; account_type: string; currency: string; balance: number; landing_company_name?: string };
type Profile = { id: string; account_id: string; full_name: string; email: string; current_plan: string; joined_at: string };
type Config = { targetProfit: number; targetLoss: number; stakeAmount: number; currency: string };

const LOGO = logoUrl;
const FIXED_SYMBOL = "1HZ100V";
const SYMBOL_LABEL = "Volatility 100 (1s) Index";
const EMPTY_CONFIG: Config = { targetProfit: 0, targetLoss: 0, stakeAmount: 1, currency: "USD" };

function useMarketData() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [latest, setLatest] = useState<Record<string, number>>({});
  const [connection, setConnection] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    const appId = import.meta.env.VITE_DERIV_APP_ID as string | undefined;
    if (!appId) {
      setConnection("disconnected");
      setError("Deriv market data is not configured.");
      return;
    }

    let socket: WebSocket | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    let retryCount = 0;
    let stopped = false;
    let subscribed = new Set<string>();

    const connect = () => {
      if (stopped) return;
      setConnection("connecting");
      socket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`);
      socket.onopen = () => {
        retryCount = 0;
        retryDelay = 1000;
        setConnection("connected");
        setError("");
        socket?.send(JSON.stringify({ active_symbols: "brief", product_type: "basic" }));
      };
      socket.onmessage = (event) => {
        let payload: Record<string, unknown>;
        try { payload = JSON.parse(String(event.data)) as Record<string, unknown>; } catch { return; }
        if (payload.error && typeof payload.error === "object") {
          setError("Deriv could not provide market data. Check the app ID and try again.");
          return;
        }
        if (Array.isArray(payload.active_symbols)) {
          const volatility = (payload.active_symbols as Market[]).filter((market) =>
            market.market === "synthetic_index" && /volatility/i.test(market.display_name),
          );
          setMarkets(volatility);
          const symbols = new Set(volatility.slice(0, 10).map((market) => market.symbol));
          if (volatility.some((market) => market.symbol === FIXED_SYMBOL)) symbols.add(FIXED_SYMBOL);
          subscribed = symbols;
          symbols.forEach((symbol) => socket?.send(JSON.stringify({ ticks: symbol, subscribe: 1 })));
        }
        if (payload.tick && typeof payload.tick === "object") {
          const tick = payload.tick as { symbol?: string; epoch?: number; quote?: number };
          if (!tick.symbol || typeof tick.quote !== "number" || typeof tick.epoch !== "number") return;
          setLatest((current) => ({ ...current, [tick.symbol!]: tick.quote! }));
          if (tick.symbol === FIXED_SYMBOL) {
            setTicks((current) => [...current.slice(-89), { epoch: tick.epoch!, quote: tick.quote! }]);
          }
        }
      };
      socket.onerror = () => setError("Market data connection interrupted.");
      socket.onclose = () => {
        if (stopped) return;
        setConnection("disconnected");
        if (retryCount >= 8) {
          setError("Market data reconnect limit reached. Refresh to try again.");
          return;
        }
        retryTimer = setTimeout(connect, retryDelay);
        retryCount += 1;
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ forget_all: "ticks" }));
      }
      socket?.close();
    };
  }, []);

  return { markets, ticks, latest, connection, error };
}

function App() {
  const [tab, setTab] = useState<Tab>("Home");
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [splash, setSplash] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [accountMenu, setAccountMenu] = useState(false);
  const [noticeMenu, setNoticeMenu] = useState(false);
  const [notices, setNotices] = useState<Array<{ id: string; type: string; message: string; created_at: string; read_at?: string | null }>>([]);
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG);
  const [configBusy, setConfigBusy] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [botStatus, setBotStatus] = useState("Disconnected");
  const [botReason, setBotReason] = useState("Connect a Deriv account to check readiness.");
  const [summary, setSummary] = useState<{ profitLoss: number; wins: number; losses: number; winRate: number | null } | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toastSequence = useRef(0);
  const market = useMarketData();

  const notify = (kind: Toast["kind"], message: string) => {
    const id = ++toastSequence.current;
    setToasts((current) => [...current, { id, kind, message }]);
    if (kind !== "error") setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4400);
  };

  useEffect(() => {
    const splashTimer = setTimeout(() => setSplash(false), 10_000);
    if (!supabase) {
      setAuthLoading(false);
      return () => clearTimeout(splashTimer);
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? { id: data.session.user.id } : null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ? { id: nextSession.user.id } : null);
      setPasswordRecovery(event === "PASSWORD_RECOVERY");
    });
    return () => {
      clearTimeout(splashTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setAccounts([]);
      setSelectedAccount(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      api<{ profile: Profile }>("/api/me"),
      api<{ configuration: Record<string, unknown> | null }>("/api/config"),
      api<{ connected: boolean; accounts: DerivAccount[]; selectedAccountId: string | null }>("/api/deriv/accounts"),
      api<{ status: string; reason: string }>("/api/bot/status"),
      api<{ profitLoss: number; wins: number; losses: number; winRate: number | null }>("/api/trades/summary"),
      api<{ notifications: typeof notices }>("/api/notifications"),
    ]).then(([me, savedConfig, accountData, status, tradeSummary, notificationData]) => {
      if (cancelled) return;
      setProfile(me.profile);
      setConfigLoaded(true);
      if (savedConfig.configuration) {
        const saved = savedConfig.configuration;
        setConfig({
          targetProfit: Number(saved.target_profit),
          targetLoss: Number(saved.target_loss),
          stakeAmount: Number(saved.stake_amount),
          currency: String(saved.currency),
        });
      }
      setAccounts(accountData.accounts ?? []);
      setSelectedAccount(accountData.accounts?.find((account) => account.account_id === accountData.selectedAccountId) ?? null);
      setBotStatus(status.status);
      setBotReason(status.reason);
      setSummary(tradeSummary);
      setNotices(notificationData.notifications ?? []);
    }).catch((error: unknown) => {
      if (!cancelled) notify("warning", error instanceof Error ? error.message : "Unable to load your account data.");
    });
    return () => { cancelled = true; };
  }, [session?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("deriv") === "connected") {
      notify("success", "Deriv account connected.");
      window.history.replaceState({}, "", window.location.pathname);
      if (session) api<{ accounts: DerivAccount[] }>("/api/deriv/accounts").then((data) => setAccounts(data.accounts)).catch(() => undefined);
    } else if (params.get("deriv") === "error") {
      notify("error", "Deriv authorization could not be completed. Try connecting again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [session]);

  useEffect(() => {
    let active = true;
    const listener = CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
      const callback = new URL(url);
      const result = callback.searchParams.get("deriv");
      if (result === "connected") {
        await Browser.close().catch(() => undefined);
        notify("success", "Deriv account connected.");
        if (session) {
          try {
            const data = await api<{ accounts: DerivAccount[]; selectedAccountId: string | null }>("/api/deriv/accounts");
            if (active) {
              setAccounts(data.accounts);
              setSelectedAccount(data.accounts.find((account) => account.account_id === data.selectedAccountId) ?? null);
            }
          } catch { notify("warning", "Deriv linked, but account details could not be refreshed."); }
        }
      } else if (result === "error") {
        await Browser.close().catch(() => undefined);
        notify("error", "Deriv authorization could not be completed. Try connecting again.");
      }
    });
    return () => {
      active = false;
      void listener.then((handle) => handle.remove());
    };
  }, [session?.id]);

  const fixedPrice = market.latest[FIXED_SYMBOL];
  const displayPrice = typeof fixedPrice === "number" ? fixedPrice.toFixed(2) : "--";
  const chartData = useMemo(() => market.ticks.map((tick) => ({ ...tick, time: new Date(tick.epoch * 1000).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }) })), [market.ticks]);

  const connectDeriv = async () => {
    try {
      const mobile = Capacitor.isNativePlatform();
      const { authorizationUrl } = await api<{ authorizationUrl: string }>("/api/deriv/oauth/start", { method: "POST", body: JSON.stringify({ client: mobile ? "mobile" : "web" }) });
      if (mobile) await Browser.open({ url: authorizationUrl });
      else window.location.assign(authorizationUrl);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not start Deriv authorization.");
    }
  };

  const refreshAccounts = async () => {
    setAccountBusy(true);
    try {
      const data = await api<{ connected: boolean; accounts: DerivAccount[]; selectedAccountId: string | null }>("/api/deriv/accounts");
      setAccounts(data.accounts ?? []);
      setSelectedAccount(data.accounts?.find((account) => account.account_id === data.selectedAccountId) ?? null);
      if (!data.connected) notify("information", "Connect a Deriv account to view its balance.");
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not refresh Deriv accounts.");
    } finally { setAccountBusy(false); }
  };

  const selectAccount = async (account: DerivAccount) => {
    const mode = account.account_type.toLowerCase() === "real" ? "real" : "demo";
    if (mode === "real" && !window.confirm("Select this real-money account? No trades will be enabled until strategy and safety checks are complete.")) return;
    try {
      await api("/api/deriv/accounts/select", { method: "POST", body: JSON.stringify({ accountId: account.account_id, mode, confirmReal: mode === "real" }) });
      setSelectedAccount(account);
      setConfig((current) => ({ ...current, currency: account.currency }));
      notify("success", `${mode === "real" ? "Real" : "Demo"} account selected.`);
    } catch (error) { notify("error", error instanceof Error ? error.message : "Could not select that account."); }
  };

  const switchAccountMode = async (mode: "demo" | "real") => {
    const available = accounts.filter((account) => account.account_type.toLowerCase() === mode);
    if (!available.length) {
      notify("information", `No ${mode === "real" ? "Real" : "Demo"} account is available on this Deriv connection.`);
      return;
    }
    const target = available.find((account) => account.account_id === selectedAccount?.account_id) ?? available[0];
    if (target.account_id !== selectedAccount?.account_id) await selectAccount(target);
  };

  const disconnectDeriv = async () => {
    try {
      await api("/api/deriv/disconnect", { method: "POST", body: "{}" });
      setAccounts([]);
      setSelectedAccount(null);
      notify("information", "Deriv account disconnected.");
    } catch (error) { notify("error", error instanceof Error ? error.message : "Could not disconnect the account."); }
  };

  const saveConfig = async () => {
    setConfigBusy(true);
    try {
      await api("/api/config", { method: "PUT", body: JSON.stringify(config) });
      notify("success", "Risk configuration saved.");
    } catch (error) { notify("error", error instanceof Error ? error.message : "Could not save your configuration."); }
    finally { setConfigBusy(false); }
  };

  const startBot = async () => {
    setBotStatus("Starting");
    try {
      await api("/api/bot/start", { method: "POST", body: "{}" });
      setBotStatus("Running");
    } catch (error) {
      setBotStatus(selectedAccount ? "Ready" : "Disconnected");
      setBotReason(error instanceof Error ? error.message : "The trading engine is unavailable.");
      notify("warning", error instanceof Error ? error.message : "Trading cannot start.");
    }
  };

  const stopBot = async () => {
    try {
      const result = await api<{ status: string; message: string }>("/api/bot/stop", { method: "POST", body: "{}" });
      setBotStatus(result.status);
      notify("information", result.message);
    } catch (error) { notify("error", error instanceof Error ? error.message : "Could not stop the bot."); }
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setAccountMenu(false);
  };

  if (splash) return <Splash />;
  if (authLoading) return <Splash compact />;
  if (!supabaseConfigured || !supabase) return <ConfigurationNotice />;
  if (session && passwordRecovery) return <PasswordUpdateScreen onComplete={() => setPasswordRecovery(false)} />;
  if (!session) return <AuthScreen notify={notify} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab("Home")} aria-label="G-Squad home">
          <img src={LOGO} alt="" className="brand-logo" />
          <span>G-SQUAD<span className="brand-period">.</span></span>
        </button>
        <div className="topbar-actions">
          <div className="header-popover-wrap">
            <button className={`icon-button ${noticeMenu ? "is-open" : ""}`} aria-label="Notifications" onClick={() => { setNoticeMenu(!noticeMenu); setAccountMenu(false); }}>
              <Bell size={19} strokeWidth={1.8} />{notices.some((notice) => !notice.read_at) && <i className="unread-dot" />}
            </button>
            {noticeMenu && <div className="popover notifications-popover"><div className="popover-title">Notifications</div>{notices.length ? notices.map((notice) => <div className="notice-row" key={notice.id}><span className={`notice-dot ${notice.type}`} /><span>{notice.message}</span></div>) : <div className="empty-popover">You're all caught up.</div>}</div>}
          </div>
          <div className="header-popover-wrap">
            <button className="profile-trigger" aria-label="Account menu" onClick={() => { setAccountMenu(!accountMenu); setNoticeMenu(false); }}>
              <span className="avatar">{profile?.full_name?.slice(0, 1).toUpperCase() ?? "G"}</span><ChevronDown size={14} />
            </button>
            {accountMenu && <div className="popover account-popover"><div className="account-popover-name">{profile?.full_name || "G-Squad member"}</div><div className="account-popover-email">{profile?.email}</div><button className="popover-action" onClick={signOut}><LogOut size={15} /> Sign out</button></div>}
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="page-heading">
          <div><p className="eyebrow">YOUR TRADING DESK</p><h1>{tab === "Home" ? "Good day" : tab === "G-Squad" ? "G-Squad bot" : tab === "Configure" ? "Configure your risk" : "Your membership"}<span className="heading-period">.</span></h1></div>
          <div className={`market-status ${market.connection}`}><span className="status-pulse" />{market.connection === "connected" ? "MARKET LIVE" : market.connection === "connecting" ? "CONNECTING" : "MARKET OFFLINE"}</div>
        </div>

        {tab === "Home" && <HomePage market={market} chartData={chartData} price={displayPrice} notify={notify} />}
        {tab === "G-Squad" && <BotPage profile={profile} accounts={accounts} selectedAccount={selectedAccount} accountBusy={accountBusy} refreshAccounts={refreshAccounts} selectAccount={selectAccount} switchAccountMode={switchAccountMode} connectDeriv={connectDeriv} disconnectDeriv={disconnectDeriv} summary={summary} botStatus={botStatus} botReason={botReason} startBot={startBot} stopBot={stopBot} />}
        {tab === "Configure" && <ConfigurePage config={config} setConfig={setConfig} saveConfig={saveConfig} busy={configBusy} loaded={configLoaded} account={selectedAccount} />}
        {tab === "Subscribe" && <SubscribePage profile={profile} onSubscribe={() => notify("information", "Subscriptions Coming Soon")} />}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {([ ["Home", Home], ["G-Squad", Activity], ["Configure", Settings2], ["Subscribe", Sparkles] ] as const).map(([label, Icon]) => (
          <button key={label} className={`nav-item ${tab === label ? "active" : ""}`} onClick={() => { setTab(label); setMenuOpen(false); }}>
            <Icon size={20} strokeWidth={tab === label ? 2.4 : 1.8} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`toast toast-${toast.kind}`} key={toast.id}><span className="toast-mark">{toast.kind === "success" ? <Check size={16} /> : toast.kind === "error" ? <X size={16} /> : <CircleHelp size={16} />}</span><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={15} /></button></div>)}</div>
      {menuOpen && <button className="mobile-dismiss" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
    </div>
  );
}

function Splash({ compact = false }: { compact?: boolean }) {
  return <div className={`splash-screen ${compact ? "compact" : ""}`}><div className="splash-ring ring-one" /><div className="splash-ring ring-two" /><img className="splash-logo" src={LOGO} alt="G-Squad logo" /><div className="splash-wordmark">G-SQUAD<span>.</span></div><div className="splash-loader"><i /><i /><i /></div><div className="splash-caption">A sharper way to stay in control</div></div>;
}

function ConfigurationNotice() {
  return <div className="auth-screen"><img className="auth-logo" src={LOGO} alt="G-Squad" /><div className="auth-card"><span className="eyebrow">SETUP REQUIRED</span><h1>Connect your workspace.</h1><p>Add your Supabase project URL and public anon key to the local environment to enable secure registration and sign-in.</p><code>VITE_SUPABASE_URL<br />VITE_SUPABASE_ANON_KEY</code></div></div>;
}

function AuthScreen({ notify }: { notify: (kind: Toast["kind"], message: string) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "register") {
        if (fullName.trim().length < 2) throw new Error("Enter your full name.");
        if (password.length < 10) throw new Error("Use a password with at least 10 characters.");
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim() } } });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
          return;
        }
        notify("success", "Account created successfully.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
        if (error) throw error;
        setMessage("Password reset instructions have been sent to your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        notify("success", "Welcome back.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication could not be completed."); }
    finally { setBusy(false); }
  };

  return <div className="auth-screen"><div className="auth-art"><div className="auth-art-copy"><span className="eyebrow">THE MARKET, IN YOUR CORNER</span><h1>Clear eyes.<br />Steady hands.</h1><p>Your Deriv trading companion, built around the controls that matter.</p></div><div className="auth-art-orbit"><div className="orbit-line" /><img src={LOGO} alt="" /></div><span className="auth-art-note">01 / DISCIPLINE FIRST</span></div><section className="auth-panel"><div className="auth-brand"><img src={LOGO} alt="" /><span>G-SQUAD<span>.</span></span></div><div className="auth-form-wrap"><span className="eyebrow">{mode === "register" ? "GET STARTED" : mode === "reset" ? "ACCOUNT RECOVERY" : "WELCOME BACK"}</span><h2>{mode === "register" ? "Create your account" : mode === "reset" ? "Reset your password" : "Sign in to G-Squad"}</h2><p className="auth-subtitle">{mode === "register" ? "Your trading desk, ready when you are." : "Pick up where you left off."}</p><form onSubmit={submit} className="auth-form">{mode === "register" && <label>Full name<input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} placeholder="Your name" /></label>}<label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></label>{mode !== "reset" && <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "register" ? 10 : 1} placeholder="Enter your password" /></label>}{message && <div className="form-message" role="status">{message}</div>}{mode === "login" && <button type="button" className="text-action forgot-link" onClick={() => { setMode("reset"); setMessage(""); }}>Forgot password?</button>}<button className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait..." : mode === "register" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}<ArrowUpRight size={17} /></button></form><div className="auth-switch">{mode === "reset" ? <button className="text-action" onClick={() => setMode("login")}>Back to sign in</button> : <>{mode === "register" ? "Already have an account?" : "New to G-Squad?"} <button className="text-action" onClick={() => { setMode(mode === "register" ? "login" : "register"); setMessage(""); }}>{mode === "register" ? "Sign in" : "Create account"}</button></>}</div><div className="auth-security"><ShieldCheck size={15} /> Secure account access powered by Supabase</div></div></section></div>;
}

function PasswordUpdateScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 10) {
      setMessage("Use a password with at least 10 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else onComplete();
  };
  return <div className="auth-screen"><div className="auth-art"><div className="auth-art-copy"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>A fresh start.<br />A stronger key.</h1></div><div className="auth-art-orbit"><div className="orbit-line" /><img src={LOGO} alt="" /></div></div><section className="auth-panel"><div className="auth-brand"><img src={LOGO} alt="" /><span>G-SQUAD<span>.</span></span></div><div className="auth-form-wrap"><span className="eyebrow">NEW PASSWORD</span><h2>Choose a new password</h2><p className="auth-subtitle">Use at least 10 characters to secure your account.</p><form className="auth-form" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <div className="form-message" role="status">{message}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy ? "Updating..." : "Update password"}<ArrowUpRight size={17} /></button></form></div></section></div>;
}

function HomePage({ market, chartData, price, notify }: { market: ReturnType<typeof useMarketData>; chartData: Array<Tick & { time: string }>; price: string; notify: (kind: Toast["kind"], message: string) => void }) {
  return <div className="home-grid">
    <section className="ticker-section">
      <div className="section-label"><span className="live-dot" /> LIVE MARKETS <span className="label-divider" /> DERIV SYNTHETIC INDICES</div>
      {market.markets.length ? <div className="ticker-viewport"><div className="ticker-track">{[...market.markets, ...market.markets].map((item, index) => <div className="ticker-item" key={`${item.symbol}-${index}`}><span>{item.display_name}</span><strong>{typeof market.latest[item.symbol] === "number" ? market.latest[item.symbol].toFixed(2) : "--"}</strong></div>)}</div></div> : <div className="ticker-empty">{market.error || "Waiting for verified Deriv market symbols..."}</div>}
    </section>

    <section className="market-card panel">
      <div className="card-topline"><div><span className="eyebrow">MARKET PULSE</span><h2>{SYMBOL_LABEL}</h2></div><div className={`live-pill ${market.connection}`}><span />{market.connection === "connected" ? "LIVE" : market.connection === "connecting" ? "CONNECTING" : "OFFLINE"}</div></div>
      <div className="chart-price"><span>{price}</span><span className="price-currency">LIVE QUOTE</span></div>
      <div className="chart-meta"><span>Fixed bot market · {FIXED_SYMBOL}</span><span><Activity size={13} /> Tick stream</span></div>
      <div className="chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}><defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e5b900" stopOpacity={0.28} /><stop offset="100%" stopColor="#e5b900" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#eeeee8" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: "#96968e", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={42} /><YAxis domain={["auto", "auto"]} tick={{ fill: "#96968e", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => value.toFixed(0)} /><Tooltip contentStyle={{ background: "#fff", border: "1px solid #e8e7de", borderRadius: 9, fontSize: 12 }} formatter={(value) => [Number(value ?? 0).toFixed(2), "Price"]} labelStyle={{ color: "#77776f" }} /><Area type="monotone" dataKey="quote" stroke="#d7aa00" strokeWidth={2} fill="url(#priceFill)" isAnimationActive={false} dot={false} /></AreaChart></ResponsiveContainer> : <div className="chart-placeholder"><span className="chart-placeholder-line" /><div><Radio size={18} /><span>{market.error || "Waiting for live price ticks"}</span></div></div>}</div>
      <div className="chart-foot"><span>Source: Deriv live tick stream</span><span className="chart-foot-symbol"><span className="live-dot" /> {market.connection === "connected" ? "Receiving ticks" : "Not connected"}</span></div>
    </section>

    <section className="promo-card">
      <div className="promo-graphic"><div className="promo-sun" /><div className="promo-grid-lines" /><img src={LOGO} alt="G-Squad" /><span className="promo-graphic-label">G-SQUAD / CONTROL ROOM</span></div>
      <div className="promo-copy"><span className="eyebrow">BUILT FOR BETTER HABITS</span><h2>Trade with a plan.<br />Stay in your lane.</h2><p>Keep risk settings close, stay connected to your Deriv account, and let every decision start with clarity.</p><button className="text-action promo-action" onClick={() => notify("information", "Connect a Deriv account to get started.")}>Explore G-Squad <ArrowUpRight size={15} /></button></div>
    </section>
    <section className="home-footnote"><ShieldCheck size={15} /><span>Market data is informational. Trading carries risk; no result is guaranteed.</span><span className="home-symbol">{market.markets.length} verified volatility markets</span></section>
  </div>;
}

function BotPage(props: {
  profile: Profile | null; accounts: DerivAccount[]; selectedAccount: DerivAccount | null; accountBusy: boolean;
  refreshAccounts: () => void; selectAccount: (account: DerivAccount) => void; switchAccountMode: (mode: "demo" | "real") => void; connectDeriv: () => void; disconnectDeriv: () => void;
  summary: { profitLoss: number; wins: number; losses: number; winRate: number | null } | null;
  botStatus: string; botReason: string; startBot: () => void; stopBot: () => void;
}) {
  const [consoleEntries, setConsoleEntries] = useState<Array<{ id: number; time: string; message: string; tone?: string }>>([]);
  const append = (message: string, tone = "") => setConsoleEntries((entries) => [...entries, { id: Date.now(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), message, tone }].slice(-60));
  useEffect(() => {
    append(`Bot status: ${props.botStatus}.`);
  }, [props.botStatus]);
  useEffect(() => {
    if (props.selectedAccount) append(`Deriv account selected: ${props.selectedAccount.account_id} (${props.selectedAccount.account_type}).`, "success");
  }, [props.selectedAccount?.account_id, props.selectedAccount?.account_type]);
  const balance = props.selectedAccount ? `${props.selectedAccount.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${props.selectedAccount.currency}` : "--";
  const accountMode = props.selectedAccount ? (props.selectedAccount.account_type.toLowerCase() === "real" ? "real" : "demo") : null;
  const modeAccounts = accountMode ? props.accounts.filter((account) => account.account_type.toLowerCase() === accountMode) : [];
  const fmtMoney = (value: number | null) => value === null ? "--" : `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;

  return <div className="bot-page">
    <div className="bot-layout">
      <section className="panel bot-stats-card">
        <div className="card-topline"><div><span className="eyebrow">SESSION SNAPSHOT</span><h2>Trading statistics</h2></div><span className={`account-mode ${props.selectedAccount?.account_type === "real" ? "real" : "demo"}`}>{props.selectedAccount?.account_type === "real" ? "REAL ACCOUNT" : props.selectedAccount ? "DEMO ACCOUNT" : "NO ACCOUNT"}</span></div>
        <div className="stats-grid">
          <Stat label="Account balance" value={balance} icon={<Wallet size={15} />} />
          <Stat label="Recorded P/L" value={fmtMoney(props.summary?.profitLoss ?? null)} icon={props.summary?.profitLoss && props.summary.profitLoss < 0 ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />} tone={(props.summary?.profitLoss ?? 0) < 0 ? "negative" : "positive"} />
          <Stat label="Wins" value={props.summary ? String(props.summary.wins) : "--"} icon={<Check size={15} />} tone="positive" />
          <Stat label="Losses" value={props.summary ? String(props.summary.losses) : "--"} icon={<X size={15} />} tone="negative" />
          <Stat label="Win rate" value={props.summary?.winRate === null || props.summary?.winRate === undefined ? "--" : `${(props.summary.winRate * 100).toFixed(1)}%`} icon={<Activity size={15} />} />
        </div>
        <div className="account-actions">{props.accounts.length ? <><div className="account-mode-switch" role="group" aria-label="Deriv account mode"><button type="button" className={accountMode === "demo" ? "active" : ""} aria-pressed={accountMode === "demo"} onClick={() => props.switchAccountMode("demo")}>Demo</button><button type="button" className={accountMode === "real" ? "active" : ""} aria-pressed={accountMode === "real"} onClick={() => props.switchAccountMode("real")}>Real</button></div><span className="account-current">{props.selectedAccount ? `${props.selectedAccount.account_id} · ${props.selectedAccount.currency}` : "Select an account"}</span>{modeAccounts.length > 1 && <select aria-label={`Select ${accountMode} Deriv account`} value={props.selectedAccount?.account_id ?? ""} onChange={(event) => { const account = modeAccounts.find((item) => item.account_id === event.target.value); if (account) props.selectAccount(account); }}>{modeAccounts.map((account) => <option key={account.account_id} value={account.account_id}>{account.account_id} · {account.currency}</option>)}</select>}</> : <span className="account-none">{props.accountBusy ? "Refreshing account..." : "No Deriv account connected"}</span>}<div className="account-action-buttons">{props.accounts.length ? <><button className="small-outline" onClick={props.refreshAccounts}>Refresh</button><button className="small-link" onClick={props.disconnectDeriv}>Disconnect</button></> : <button className="small-outline" onClick={props.connectDeriv}>Connect Deriv <ArrowUpRight size={14} /></button>}</div></div>
      </section>

      <section className="panel bot-control-card">
        <div className="card-topline"><div><span className="eyebrow">AUTOMATION</span><h2>Bot controls</h2></div><span className={`bot-state ${props.botStatus.toLowerCase()}`}><i />{props.botStatus}</span></div>
        <div className="control-visual"><div className="control-orbit orbit-a" /><div className="control-orbit orbit-b" /><div className="control-core"><img src={LOGO} alt="" /></div><div className="control-center-tag">{props.botStatus === "Running" ? "ACTIVE" : "ON STANDBY"}</div></div>
        <div className="control-actions"><button className="primary-button start-button" onClick={props.startBot}><Play size={16} fill="currentColor" /> START</button><button className="stop-button" onClick={props.stopBot}><Square size={14} fill="currentColor" /> STOP</button></div>
        <div className="bot-reason"><ShieldCheck size={14} /><span>{props.botReason}</span></div>
      </section>
    </div>

    <section className="console-section">
      <div className="console-heading"><div><span className="eyebrow">SYSTEM ACTIVITY</span><h2>Trading console</h2></div><div className="console-tools"><span className="console-live"><i /> SECURE LOG</span><button className="console-clear" onClick={() => setConsoleEntries([])}>Clear</button></div></div>
      <div className="console-window" aria-live="polite">{consoleEntries.length ? consoleEntries.map((entry) => <div className={`console-line ${entry.tone}`} key={entry.id}><span>{entry.time}</span><i />{entry.message}</div>) : <div className="console-empty"><span className="console-prompt">G_SQUAD &gt;</span><span>No trading engine session is active. System messages will appear here when generated by the backend.</span></div>}</div>
      <div className="console-foot"><span>Strategy details are private</span><span><LockIcon /> Secrets are never shown</span></div>
    </section>

    <section className="safety-banner"><ShieldCheck size={17} /><div><strong>Execution is currently disabled</strong><span>The private MACD rule is configured. Controlled Demo order, settlement, and risk validation are still required.</span></div><span className="safety-tag">SAFETY LOCK</span></section>
  </div>;
}

function Stat({ label, value, icon, tone = "" }: { label: string; value: string; icon: React.ReactNode; tone?: string }) {
  return <div className="stat-item"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong className={tone}>{value}</strong></div>;
}

function LockIcon() { return <ShieldCheck size={13} />; }

function ConfigurePage({ config, setConfig, saveConfig, busy, loaded, account }: { config: Config; setConfig: (config: Config) => void; saveConfig: () => void; busy: boolean; loaded: boolean; account: DerivAccount | null }) {
  const update = (key: keyof Config, value: string) => setConfig({ ...config, [key]: key === "currency" ? value.toUpperCase() : value === "" ? 0 : Number(value) });
  return <div className="configure-page">
    <div className="configure-intro"><span className="eyebrow">RISK MANAGEMENT</span><h2>Small guardrails.<br />More room to think.</h2><p>Set the boundaries for a trading session. These controls are enforced by the backend before trading is allowed.</p></div>
    <section className="panel configure-panel">
      <div className="configure-panel-head"><div><span className="eyebrow">SESSION LIMITS</span><h2>Configure your risk</h2></div><span className="config-currency">{account?.currency ?? config.currency}</span></div>
      <label className="config-field"><span><b>01</b><span>Target profit<small>Stop initiating trades when session profit reaches this amount.</small></span></span><div className="amount-input"><span>{account?.currency ?? config.currency}</span><input type="number" min="0" step="0.01" value={config.targetProfit || ""} onChange={(event) => update("targetProfit", event.target.value)} placeholder="0.00" /></div></label>
      <label className="config-field"><span><b>02</b><span>Target loss<small>Stop initiating trades when session loss reaches this amount.</small></span></span><div className="amount-input"><span>{account?.currency ?? config.currency}</span><input type="number" min="0" step="0.01" value={config.targetLoss || ""} onChange={(event) => update("targetLoss", event.target.value)} placeholder="0.00" /></div></label>
      <label className="config-field"><span><b>03</b><span>Stake amount<small>Amount allocated to each trade, subject to account limits.</small></span></span><div className="amount-input"><span>{account?.currency ?? config.currency}</span><input type="number" min="0.01" step="0.01" value={config.stakeAmount || ""} onChange={(event) => update("stakeAmount", event.target.value)} placeholder="0.00" /></div></label>
      {!loaded && <p className="config-inline-note">Connect your account to load and save your settings.</p>}
      <button className="primary-button save-config" disabled={busy || !loaded} onClick={saveConfig}>{busy ? "Saving..." : "Save configuration"}<ArrowUpRight size={16} /></button>
    </section>
    <div className="risk-note"><ShieldCheck size={17} /><p><strong>Risk settings aren't a guarantee.</strong> Already purchased contracts may settle at a loss even after a limit is reached.</p></div>
  </div>;
}

function SubscribePage({ profile, onSubscribe }: { profile: Profile | null; onSubscribe: () => void }) {
  const joined = profile?.joined_at ? new Date(profile.joined_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "--";
  return <div className="subscribe-page">
    <section className="panel identity-card"><div className="identity-top"><div className="identity-avatar">{profile?.full_name?.slice(0, 1).toUpperCase() || "G"}</div><div><span className="eyebrow">MEMBER PROFILE</span><h2>{profile?.full_name || "G-Squad member"}</h2><span className="identity-email">{profile?.email || "--"}</span></div><span className="plan-badge">{profile?.current_plan || "Free"}</span></div><div className="identity-details"><div><span>G-Squad ID</span><strong>{profile?.account_id || "--"}</strong></div><div><span>Member since</span><strong>{joined}</strong></div><div><span>Current plan</span><strong>{profile?.current_plan || "Free"}</strong></div></div></section>
    <section className="membership-card"><div className="membership-left"><span className="membership-kicker"><Sparkles size={14} /> THE NEXT CHAPTER</span><h2>More room<br />to grow.</h2><p>G-Squad membership plans are being shaped with care. Your current plan stays Free until then.</p><button className="membership-button" onClick={onSubscribe}>Explore plans <ArrowUpRight size={16} /></button></div><div className="membership-art"><div className="membership-disc" /><div className="membership-stamp">G<br />S</div><span>MEMBERSHIP / 2026</span></div><div className="membership-status"><span className="status-led" /> FREE PLAN <span className="membership-status-line" /> COMING SOON</div></section>
    <div className="subscribe-footnote"><ShieldCheck size={15} /> No payment details are collected. Plans are not available yet.</div>
  </div>;
}

export default App;