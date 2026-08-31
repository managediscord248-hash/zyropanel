import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, dbManager, User, OAuthAccount } from './db';
import { generateToken } from './auth';

const JWT_SECRET = process.env.APP_SECRET || 'zyrocloud_development_secret_key_change_in_production_min32chars';

export interface OAuthStatePayload {
  action: 'login' | 'link';
  userId?: string;
  nonce: string;
  timestamp: number;
}

export function getAppBaseUrl(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

export function generateOAuthState(action: 'login' | 'link' = 'login', userId?: string): string {
  return jwt.sign(
    {
      action,
      userId,
      nonce: uuidv4(),
      timestamp: Date.now()
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  try {
    const payload = jwt.verify(state, JWT_SECRET) as OAuthStatePayload;
    return payload;
  } catch (err) {
    return null;
  }
}

export function generateUniqueUsername(preferredName: string, fallbackEmail: string = ''): string {
  let base = (preferredName || fallbackEmail.split('@')[0] || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);

  if (base.length < 3) base = `user_${base}`;

  let username = base;
  let attempt = 0;
  while (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    attempt++;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    username = `${base.slice(0, 15)}_${suffix}`;
    if (attempt > 20) {
      username = `user_${uuidv4().slice(0, 8)}`;
      break;
    }
  }

  return username;
}

export function getGoogleOAuthUrl(req: Request, state: string): { url: string | null; error?: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId.trim() === '') {
    return {
      url: null,
      error: 'Google OAuth is not configured yet. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.'
    };
  }

  const baseUrl = getAppBaseUrl(req);
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state: state
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  };
}

export function getDiscordOAuthUrl(req: Request, state: string): { url: string | null; error?: string } {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId || clientId.trim() === '') {
    return {
      url: null,
      error: 'Discord OAuth is not configured yet. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in environment variables.'
    };
  }

  const baseUrl = getAppBaseUrl(req);
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${baseUrl}/api/auth/discord/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    prompt: 'consent',
    state: state
  });

  return {
    url: `https://discord.com/oauth2/authorize?${params.toString()}`
  };
}

export async function exchangeGoogleCode(code: string, req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials missing on server.');
  }

  const baseUrl = getAppBaseUrl(req);
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${errBody}`);
  }

  const tokens = await tokenRes.json();
  
  // Fetch Google User Profile
  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  if (!userinfoRes.ok) {
    throw new Error('Failed to fetch Google user profile.');
  }

  const profile = await userinfoRes.json();
  return {
    provider_user_id: profile.sub,
    email: profile.email,
    name: profile.name || profile.given_name || 'Google User',
    avatar_url: profile.picture,
    email_verified: profile.email_verified
  };
}

export async function exchangeDiscordCode(code: string, req: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Discord OAuth credentials missing on server.');
  }

  const baseUrl = getAppBaseUrl(req);
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${baseUrl}/api/auth/discord/callback`;

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Discord token exchange failed (${tokenRes.status}): ${errBody}`);
  }

  const tokens = await tokenRes.json();

  // Fetch Discord User Info
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  if (!userRes.ok) {
    throw new Error('Failed to fetch Discord user profile.');
  }

  const profile = await userRes.json();
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
    : undefined;

  return {
    provider_user_id: profile.id,
    email: profile.email || `${profile.id}@discord.user`,
    name: profile.global_name || profile.username || 'Discord User',
    avatar_url: avatarUrl,
    email_verified: !!profile.verified
  };
}

export function renderOAuthPopupResult(options: {
  success: boolean;
  token?: string;
  user?: any;
  provider?: string;
  action?: string;
  error?: string;
}) {
  const safeMessage = JSON.stringify({
    type: options.success ? 'OAUTH_AUTH_SUCCESS' : 'OAUTH_AUTH_ERROR',
    token: options.token,
    user: options.user,
    provider: options.provider,
    action: options.action,
    error: options.error
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ZyroCloud Authentication</title>
  <style>
    body {
      background-color: #070b14;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #0c121e;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      max-width: 380px;
    }
    .spinner {
      border: 3px solid rgba(6, 182, 212, 0.2);
      border-top-color: #06b6d4;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status { font-size: 14px; font-weight: 600; color: #38bdf8; }
    .error { color: #f87171; font-size: 13px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div class="status">${options.success ? 'Authentication successful! Closing window...' : 'Authentication failed.'}</div>
    ${options.error ? `<div class="error">${options.error}</div>` : ''}
  </div>
  <script>
    (function() {
      var data = ${safeMessage};
      if (window.opener) {
        window.opener.postMessage(data, '*');
        setTimeout(function() {
          window.close();
        }, 600);
      } else {
        setTimeout(function() {
          window.location.href = '/';
        }, 1200);
      }
    })();
  </script>
</body>
</html>
  `;
}
