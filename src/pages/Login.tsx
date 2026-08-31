import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';
import {
  Zap,
  Shield,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  X,
  Sparkles,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

type AuthTab = 'login' | 'signup' | 'forgot';

export const Login: React.FC = () => {
  const { login, register, setSession, isLoading: isAuthLoading } = useAuth();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Sign In States
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('ZyroCloud2026!SecureAdmin');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up States
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Forgot / Reset Password States
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');

  // Feedback States
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSocialLoading, setIsSocialLoading] = useState<'google' | 'discord' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const popupRef = useRef<Window | null>(null);

  // Listen for OAuth Popup PostMessages
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Validate origin if desired, or handle message structure
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'OAUTH_AUTH_SUCCESS') {
        setIsSocialLoading(null);
        if (event.data.token && event.data.user) {
          setSession(event.data.token, event.data.user);
        }
      } else if (event.data.type === 'OAUTH_AUTH_ERROR') {
        setIsSocialLoading(null);
        setError(event.data.error || 'Social authentication failed. Please try again.');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [setSession]);

  // Open Centered OAuth Popup
  const openOAuthPopup = async (provider: 'google' | 'discord') => {
    setError(null);
    setSuccessMsg(null);
    setIsSocialLoading(provider);

    try {
      let authUrl = '';
      if (provider === 'google') {
        const res = await api.getGoogleAuthUrl('login');
        authUrl = res.url;
      } else {
        const res = await api.getDiscordAuthUrl('login');
        authUrl = res.url;
      }

      const width = 520;
      const height = 660;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        `${provider}_oauth_window`,
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      popupRef.current = popup;

      // Monitor popup closure
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setIsSocialLoading((current) => (current === provider ? null : current));
        }
      }, 800);
    } catch (err: any) {
      setIsSocialLoading(null);
      setError(
        err.message ||
          `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth is not configured. Add credentials to your .env file.`
      );
    }
  };

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Sign Up Submit
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Client-side validations
    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        username: signupUsername.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        confirm_password: signupConfirmPassword
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Forgot Password Request
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await api.forgotPassword(forgotEmail.trim());
      setSuccessMsg(res.message);
      if (res.reset_token) {
        setResetToken(res.reset_token);
        setResetStep('reset');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to process password reset request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Password Reset
  const handleResetExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.resetPassword({
        token: resetToken,
        new_password: newPassword,
        confirm_password: confirmNewPassword
      });
      setSuccessMsg(res.message);
      setTimeout(() => {
        setActiveTab('login');
        setResetStep('request');
        setResetToken('');
        setNewPassword('');
        setConfirmNewPassword('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The token may be expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setActiveTab('login');
  };

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const pwStrength = getPasswordStrength(signupPassword);

  return (
    <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4 relative overflow-hidden selection:bg-cyan-500 selection:text-slate-950">
      {/* Ambient background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-900/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Panel Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-3 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
            <Zap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-['Rajdhani',sans-serif]">
            {settings.panel_name || 'ZYROCLOUD'}
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            SELF-HOSTED GAME SERVER ORCHESTRATION PANEL
          </p>
        </div>

        {/* Card Box */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-7 shadow-2xl backdrop-blur-xl">
          {/* Header Tabs */}
          {activeTab !== 'forgot' ? (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/90 border border-slate-800/80 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all font-mono uppercase tracking-wider ${
                  activeTab === 'login'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all font-mono uppercase tracking-wider ${
                  activeTab === 'signup'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 font-mono uppercase">
                <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
                <span>Account Recovery</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[11px] text-cyan-400 hover:underline font-mono"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* SOCIAL LOGIN BUTTONS (Shown on Sign In & Sign Up tabs) */}
          {activeTab !== 'forgot' && (
            <div className="space-y-2.5 mb-6">
              <button
                type="button"
                onClick={() => openOAuthPopup('google')}
                disabled={isSocialLoading !== null || isSubmitting || isAuthLoading}
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800/80 hover:border-slate-700 py-2.5 px-4 text-xs font-medium text-slate-200 transition-all shadow-sm group disabled:opacity-50"
              >
                {isSocialLoading === 'google' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>
                  {activeTab === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openOAuthPopup('discord')}
                disabled={isSocialLoading !== null || isSubmitting || isAuthLoading}
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 hover:border-[#5865F2]/70 py-2.5 px-4 text-xs font-medium text-indigo-200 transition-all shadow-sm group disabled:opacity-50"
              >
                {isSocialLoading === 'discord' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4 shrink-0 text-[#5865F2] fill-current" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.893a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                )}
                <span>
                  {activeTab === 'login' ? 'Continue with Discord' : 'Sign up with Discord'}
                </span>
              </button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800/80" />
                </div>
                <span className="relative bg-[#0c121e] px-3 text-[10px] font-mono uppercase text-slate-500">
                  Or continue with credentials
                </span>
              </div>
            </div>
          )}

          {/* TAB 1: SIGN IN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Username or Email</label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin or user@domain.com"
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                  />
                  <Shield className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-medium">Access Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('forgot');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-10 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                  />
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isAuthLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 py-2.5 font-bold text-slate-950 hover:from-cyan-400 hover:to-cyan-300 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {isSubmitting || isAuthLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                ) : (
                  <>
                    <span>AUTHENTICATE & ENTER</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: SIGN UP FORM */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    placeholder="cyber_operator"
                    required
                    minLength={3}
                    maxLength={30}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                  />
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="pilot@zyrocloud.net"
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-10 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                  />
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password strength indicators */}
                {signupPassword.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1 h-1">
                      <div className={`flex-1 rounded-full ${pwStrength >= 1 ? 'bg-rose-500' : 'bg-slate-800'}`} />
                      <div className={`flex-1 rounded-full ${pwStrength >= 2 ? 'bg-amber-500' : 'bg-slate-800'}`} />
                      <div className={`flex-1 rounded-full ${pwStrength >= 3 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                      <div className={`flex-1 rounded-full ${pwStrength >= 4 ? 'bg-cyan-400' : 'bg-slate-800'}`} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Strength: {pwStrength < 2 ? 'Weak' : pwStrength < 4 ? 'Good' : 'Strong'}</span>
                      <span>8+ chars, numbers & symbols</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-10 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                  />
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  {signupConfirmPassword && (
                    <div className="absolute right-3 top-2.5">
                      {signupPassword === signupConfirmPassword ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <X className="h-4 w-4 text-rose-400" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isAuthLoading}
                className="w-full mt-3 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 py-2.5 font-bold text-slate-950 hover:from-cyan-400 hover:to-cyan-300 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {isSubmitting || isAuthLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                ) : (
                  <>
                    <span>CREATE ZYROCLOUD ACCOUNT</span>
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: FORGOT / RESET PASSWORD */}
          {activeTab === 'forgot' && (
            <div>
              {resetStep === 'request' ? (
                <form onSubmit={handleForgotRequest} className="space-y-4 text-xs">
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Enter your registered email address below. We'll generate a secure password reset token for your account.
                  </p>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Registered Email</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="pilot@zyrocloud.net"
                        required
                        className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                      />
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    ) : (
                      <>
                        <span>GENERATE RESET TOKEN</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetExecute} className="space-y-4 text-xs">
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Token verified. Set a new secure password for your ZyroCloud account.
                  </p>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repeat new password"
                      required
                      className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    ) : (
                      <>
                        <span>UPDATE PASSWORD & SIGN IN</span>
                        <CheckCircle2 className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Quick-fill sample accounts */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-mono mb-2 flex items-center justify-between">
              <span>QUICK SIGN-IN PROFILES:</span>
              <span className="text-[10px] text-slate-500 font-sans">Click to fill</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillCredentials('admin', 'ZyroCloud2026!SecureAdmin')}
                className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 text-left transition-colors"
              >
                <div className="font-semibold text-white font-mono">admin</div>
                <div className="text-[10px] text-cyan-400">Master Administrator</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('alex_gamer', 'PlayerOne2026!')}
                className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 text-left transition-colors"
              >
                <div className="font-semibold text-white font-mono">alex_gamer</div>
                <div className="text-[10px] text-purple-400">Standard User</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security watermark */}
        <div className="mt-6 text-center text-[11px] font-mono text-slate-400">
          TLS-Encrypted JWT Session • Zero-Trust Daemon Communication
        </div>
      </div>
    </div>
  );
};
