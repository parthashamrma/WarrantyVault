import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, OtpFlowType } from '../context/AuthContext';
import { validateUserName, validatePassword } from '../lib/validation';

type AuthMode = 'login' | 'register' | 'otp' | 'forgot' | 'recovery_password';

interface AuthPageProps {
  initialMode?: 'login' | 'register' | 'forgot';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    user,
    signIn,
    signUp,
    verifyOtp,
    signInWithOtp,
    resendOtp,
    resetPassword,
    updatePassword,
  } = useAuth();

  // If already logged in and confirmed, redirect to dashboard or next
  useEffect(() => {
    if (user && user.email_confirmed_at) {
      const next = searchParams.get('next');
      const target = next && next.startsWith('/') ? next : '/dashboard';
      navigate(target, { replace: true });
    }
  }, [user, navigate, searchParams]);

  // Sync mode with prop change
  useEffect(() => {
    if (initialMode === 'login' || initialMode === 'register' || initialMode === 'forgot') {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Login sub-type: 'password' or 'otp'
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [otpToken, setOtpToken] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpType, setOtpType] = useState<OtpFlowType>('signup');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  // Vault Combination Dial State
  const [rot, setRot] = useState(0);
  const [unlocked, setUnlocked] = useState(false);

  // Turn dial on keystrokes
  const turnDial = () => {
    setRot((prev) => prev + 23);
  };

  // Cooldown countdown effect for Resend OTP button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Check if unverified query param is set
  useEffect(() => {
    if (searchParams.get('unverified') === 'true') {
      setServerError('Your email address is unverified. Please enter the 6-digit verification code to continue.');
    }
  }, [searchParams]);

  // Reset errors when switching modes
  useEffect(() => {
    setUnlocked(false);
    setServerError(null);
    setErrors({});
    setTouched({});
    setConfirmationNotice(null);
    setForgotSuccess(null);
  }, [mode]);

  // Password strength meter calculation (4 segments)
  const getPasswordScore = (pw: string) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^\w\s]/.test(pw) || pw.length >= 14) s++;
    return s;
  };

  const score = getPasswordScore(password);
  const strengthHints = ['Weak', 'Weak', 'Okay', 'Good', 'Strong'];

  // Validation Rules
  const validateField = (field: string, val?: string): string => {
    if (field === 'name') {
      const v = (val !== undefined ? val : name).trim();
      const res = validateUserName(v);
      if (!res.valid && res.error) return res.error;
    }
    if (field === 'email') {
      const v = (val !== undefined ? val : email).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!v || !emailRegex.test(v)) {
        return 'That email doesn’t look right. Check for typos.';
      }
    }
    if (field === 'pw') {
      const v = val !== undefined ? val : password;
      if (mode === 'login') {
        if (!v) return 'Enter your password.';
        if (v.length < 8) return 'Use at least 8 characters.';
      } else {
        const check = validatePassword(v);
        if (!check.valid && check.error) return check.error;
      }
    }
    if (field === 'confirm') {
      const v = val !== undefined ? val : confirmPassword;
      if (v !== password) return 'Passwords don’t match yet.';
    }
    if (field === 'otp') {
      const v = (val !== undefined ? val : otpToken).trim();
      if (!v || v.length !== 6 || !/^\d{6}$/.test(v)) {
        return 'Enter the complete 6-digit numerical code.';
      }
    }
    return '';
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleInputChange = (field: string, value: string) => {
    turnDial();
    if (field === 'name') setName(value);
    if (field === 'email') setEmail(value);
    if (field === 'otp') setOtpToken(value.replace(/\D/g, '').slice(0, 6));
    if (field === 'pw') {
      setPassword(value);
      if (touched['confirm'] && confirmPassword) {
        const cErr = value !== confirmPassword ? 'Passwords don’t match yet.' : '';
        setErrors((prev) => ({ ...prev, confirm: cErr }));
      }
    }
    if (field === 'confirm') setConfirmPassword(value);

    // Live validation if field was touched or currently has an error
    if (touched[field] || errors[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  // Submit Handler for all flows
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setConfirmationNotice(null);
    setForgotSuccess(null);

    // 1. LOGIN FLOW
    if (mode === 'login') {
      const emailErr = validateField('email', email);
      if (emailErr) {
        setErrors({ email: emailErr });
        setTouched({ email: true });
        return;
      }

      if (loginMethod === 'otp') {
        // Passwordless OTP Login (shouldCreateUser: false mandatory)
        setSubmitting(true);
        setRot((prev) => prev + 180);
        try {
          const res = await signInWithOtp(email);
          if (res.error) {
            setServerError(res.error);
            setSubmitting(false);
            return;
          }
          setOtpEmail(email);
          setOtpType('email');
          setMode('otp');
          setResendCooldown(60);
          setConfirmationNotice(`Enter the 6-digit sign-in code sent to ${email}.`);
        } catch (err: any) {
          setServerError(err.message || 'Failed to dispatch sign-in code.');
        } finally {
          setSubmitting(false);
        }
        return;
      }

      // Password Login
      const pwErr = validateField('pw', password);
      if (pwErr) {
        setErrors({ pw: pwErr });
        setTouched({ pw: true });
        return;
      }

      setSubmitting(true);
      setRot((prev) => prev + 180);

      try {
        const res = await signIn(email, password);
        if (res.unverified) {
          // Block login and redirect to OTP screen
          setOtpEmail(email);
          setOtpType('signup');
          setMode('otp');
          setResendCooldown(60);
          setServerError(res.error || 'Your email address is unverified. Enter the 6-digit code sent to your email.');
          setSubmitting(false);
          return;
        }

        if (res.error) {
          setServerError(res.error);
          setSubmitting(false);
          return;
        }

        // Login Succeeded
        setUnlocked(true);
        setTimeout(() => {
          const next = searchParams.get('next');
          const target = next && next.startsWith('/') ? next : '/dashboard';
          navigate(target);
        }, 800);
      } catch (err: any) {
        setServerError(err.message || 'Failed to sign in.');
        setSubmitting(false);
      }
      return;
    }

    // 2. SIGNUP FLOW (New users only)
    if (mode === 'register') {
      const nameErr = validateField('name', name);
      const emailErr = validateField('email', email);
      const pwErr = validateField('pw', password);
      const confErr = validateField('confirm', confirmPassword);

      const newErrors: Record<string, string> = {};
      if (nameErr) newErrors.name = nameErr;
      if (emailErr) newErrors.email = emailErr;
      if (pwErr) newErrors.pw = pwErr;
      if (confErr) newErrors.confirm = confErr;

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setTouched({ name: true, email: true, pw: true, confirm: true });
        return;
      }

      setSubmitting(true);
      setRot((prev) => prev + 180);

      try {
        const res = await signUp(email, password, name);
        if (res.error) {
          setServerError(res.error);
          setSubmitting(false);
          return;
        }

        // Do NOT treat as logged in. Transition to 6-digit OTP screen!
        setOtpEmail(email);
        setOtpType('signup');
        setMode('otp');
        setResendCooldown(60);
        setConfirmationNotice(`Enter the 6-digit verification code sent to ${email}.`);
      } catch (err: any) {
        setServerError(err.message || 'Registration failed.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 3. OTP VERIFICATION FLOW
    if (mode === 'otp') {
      const otpErr = validateField('otp', otpToken);
      if (otpErr) {
        setErrors({ otp: otpErr });
        setTouched({ otp: true });
        return;
      }

      setSubmitting(true);
      setRot((prev) => prev + 180);

      try {
        const targetEmail = otpEmail || email;
        const res = await verifyOtp(targetEmail, otpToken, otpType);
        if (res.error) {
          setServerError(res.error);
          setSubmitting(false);
          return;
        }

        // If recovery flow, move to set new password step
        if (otpType === 'recovery') {
          setMode('recovery_password');
          setPassword('');
          setConfirmPassword('');
          setConfirmationNotice('Identity verified. Please set your new vault master password.');
          setSubmitting(false);
          return;
        }

        // Signup or Email login verification succeeded: Active session created!
        setUnlocked(true);
        setTimeout(() => {
          const next = searchParams.get('next');
          const target = next && next.startsWith('/') ? next : '/dashboard';
          navigate(target);
        }, 800);
      } catch (err: any) {
        setServerError(err.message || 'Verification failed. Please try again.');
        setSubmitting(false);
      }
      return;
    }

    // 4. FORGOT PASSWORD (OTP BASED)
    if (mode === 'forgot') {
      const emailErr = validateField('email', email);
      if (emailErr) {
        setErrors({ email: emailErr });
        setTouched({ email: true });
        return;
      }

      setSubmitting(true);
      setRot((prev) => prev + 180);

      try {
        const res = await resetPassword(email);
        if (res.error) {
          setServerError(res.error);
          setSubmitting(false);
          return;
        }

        setOtpEmail(email);
        setOtpType('recovery');
        setMode('otp');
        setResendCooldown(60);
        setConfirmationNotice(`Enter the 6-digit recovery code sent to ${email}.`);
      } catch (err: any) {
        setServerError(err.message || 'Password reset request failed.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 5. RECOVERY NEW PASSWORD FLOW
    if (mode === 'recovery_password') {
      const pwErr = validateField('pw', password);
      const confErr = validateField('confirm', confirmPassword);

      const newErrors: Record<string, string> = {};
      if (pwErr) newErrors.pw = pwErr;
      if (confErr) newErrors.confirm = confErr;

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setTouched({ pw: true, confirm: true });
        return;
      }

      setSubmitting(true);
      setRot((prev) => prev + 180);

      try {
        const res = await updatePassword(password);
        if (res.error) {
          setServerError(res.error);
          setSubmitting(false);
          return;
        }

        setUnlocked(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 800);
      } catch (err: any) {
        setServerError(err.message || 'Failed to update password.');
        setSubmitting(false);
      }
    }
  };

  // Resend OTP Code Handler
  const handleResendCode = async () => {
    if (resendCooldown > 0 || submitting) return;
    setServerError(null);
    setSubmitting(true);

    try {
      const targetEmail = otpEmail || email;
      const res = await resendOtp(targetEmail, otpType);
      if (res.error) {
        setServerError(res.error);
      } else {
        setConfirmationNotice(res.message || 'A fresh 6-digit verification code has been dispatched.');
        setResendCooldown(60);
      }
    } catch (err: any) {
      setServerError(err.message || 'Could not resend verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  // Aside copy by mode
  const asideContent = {
    login: {
      eyebrow: 'Welcome back',
      heading: (
        <>
          Your paperwork <em>waited.</em>
        </>
      ),
      text: 'Sign in to see what’s expiring, what’s covered and what you’ve filed.',
    },
    register: {
      eyebrow: 'New vault',
      heading: (
        <>
          Start with <em>one</em> warranty.
        </>
      ),
      text: 'Create an account, then add your first product, date and invoice. The vault watches the calendar.',
    },
    otp: {
      eyebrow: 'Security Check',
      heading: (
        <>
          Verify <em>your key.</em>
        </>
      ),
      text: 'We require a 6-digit one-time code to activate your vault and ensure your records remain strictly yours.',
    },
    forgot: {
      eyebrow: 'Lost the key',
      heading: (
        <>
          We’ll send <em>a new one.</em>
        </>
      ),
      text: 'Enter your email and we’ll dispatch a secure 6-digit recovery code to reset your password.',
    },
    recovery_password: {
      eyebrow: 'Master Key Update',
      heading: (
        <>
          Secure your <em>vault.</em>
        </>
      ),
      text: 'Set a new strong password for your account to restore complete access.',
    },
  }[mode];

  return (
    <section className="auth">
      {/* 1. LEFT ASIDE PANEL */}
      <aside className="aside">
        <div className="flex items-center justify-between gap-4 md:block">
          <div>
            <div className="eyebrow" id="aeye">
              {asideContent.eyebrow}
            </div>
            <h2 id="ahead">{asideContent.heading}</h2>
            <p id="atext" className="hidden md:block">
              {asideContent.text}
            </p>
          </div>

          {/* Combination Dial Graphic */}
          <svg
            className={`dial ${unlocked ? 'open' : ''} shrink-0`}
            id="dial"
            viewBox="0 0 260 260"
            aria-hidden="true"
          >
            <circle cx="130" cy="130" r="126" fill="none" stroke="currentColor" strokeOpacity=".25" />
            <g className="rot" style={{ transform: `rotate(${rot}deg)` }}>
              <circle
                cx="130"
                cy="130"
                r="110"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeOpacity=".6"
                strokeDasharray="1.5 10.019"
              />
              <g
                fontFamily="DM Mono,monospace"
                fontSize="11"
                fill="currentColor"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                <text x="130" y="46">
                  0
                </text>
                <text x="214" y="130">
                  25
                </text>
                <text x="130" y="214">
                  50
                </text>
                <text x="46" y="130">
                  75
                </text>
              </g>
            </g>
            <circle cx="130" cy="130" r="70" fill="#15120F" stroke="currentColor" strokeOpacity=".35" />
            <text
              id="dtext"
              x="130"
              y="130"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="DM Mono,monospace"
              fontSize="12"
              letterSpacing="3"
              fill="currentColor"
              fontWeight="bold"
            >
              {unlocked ? 'UNLOCKED' : 'LOCKED'}
            </text>
            <polygon points="121,0 139,0 130,17" fill="#F2B134" />
          </svg>
        </div>
      </aside>

      {/* 2. RIGHT FORM PANEL */}
      <div className="pane">
        <div className="fw">
          <Link className="back" to="/">
            ← Back to home
          </Link>

          {/* Server Error Alert */}
          {serverError && (
            <div
              className="mb-4 p-3 border border-[var(--r)] bg-[var(--r)]/10 text-[var(--r)] text-xs font-mono"
              role="alert"
            >
              {serverError}
            </div>
          )}

          {/* Confirmation / Info Notice */}
          {confirmationNotice && (
            <div
              className="mb-4 p-3 border border-[var(--g)] bg-[var(--g)]/10 text-[var(--g)] text-xs font-mono"
              role="status"
            >
              {confirmationNotice}
            </div>
          )}

          {/* Forgot Password Notice */}
          {forgotSuccess && (
            <div
              className="mb-4 p-3 border border-[var(--g)] bg-[var(--g)]/10 text-[var(--g)] text-xs font-mono"
              role="status"
            >
              {forgotSuccess}
            </div>
          )}

          {/* --- LOGIN MODE --- */}
          {mode === 'login' && (
            <form onSubmit={handleSubmit} noValidate>
              <h1>Sign in</h1>
              <p className="lede">Pick up where you left off.</p>

              {/* Login Method Toggle */}
              <div className="flex border border-[var(--line)] rounded mb-5 p-0.5 bg-[var(--bg2)]">
                <button
                  type="button"
                  onClick={() => setLoginMethod('password')}
                  className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wider transition ${
                    loginMethod === 'password'
                      ? 'bg-[var(--ink)] text-[var(--bg)] font-bold shadow-sm'
                      : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMethod('otp')}
                  className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wider transition ${
                    loginMethod === 'otp'
                      ? 'bg-[var(--ink)] text-[var(--bg)] font-bold shadow-sm'
                      : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  6-Digit OTP
                </button>
              </div>

              <div className="f">
                <label htmlFor="le">Email</label>
                <input
                  id="le"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!errors.email}
                />
                <span className="err" aria-live="polite">
                  {errors.email}
                </span>
              </div>

              {loginMethod === 'password' && (
                <div className="f">
                  <label htmlFor="lp">Password</label>
                  <div className="pwrow">
                    <input
                      id="lp"
                      name="pw"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => handleInputChange('pw', e.target.value)}
                      onBlur={() => handleBlur('pw')}
                      aria-invalid={!!errors.pw}
                    />
                    <button
                      type="button"
                      className="eye"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <span className="err" aria-live="polite">
                    {errors.pw}
                  </span>
                </div>
              )}

              <button className="btn sub" type="submit" disabled={submitting}>
                {submitting
                  ? 'Checking…'
                  : loginMethod === 'otp'
                  ? 'Send 6-digit code'
                  : 'Unlock vault'}
              </button>

              <p className="alt">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="hover:text-[var(--ink)] cursor-pointer"
                >
                  Forgot password?
                </button>
                {' · '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="hover:text-[var(--ink)] cursor-pointer"
                >
                  Create a vault
                </button>
              </p>
            </form>
          )}

          {/* --- REGISTER MODE --- */}
          {mode === 'register' && (
            <form onSubmit={handleSubmit} noValidate>
              <h1>Create your vault</h1>
              <p className="lede">One account, every warranty.</p>

              <div className="f">
                <label htmlFor="rn">Name</label>
                <input
                  id="rn"
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  aria-invalid={!!errors.name}
                />
                <span className="err" aria-live="polite">
                  {errors.name}
                </span>
              </div>

              <div className="f">
                <label htmlFor="re">Email</label>
                <input
                  id="re"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!errors.email}
                />
                <span className="err" aria-live="polite">
                  {errors.email}
                </span>
              </div>

              <div className="f">
                <label htmlFor="rp">Password</label>
                <div className="pwrow">
                  <input
                    id="rp"
                    name="pw"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => handleInputChange('pw', e.target.value)}
                    onBlur={() => handleBlur('pw')}
                    aria-invalid={!!errors.pw}
                  />
                  <button
                    type="button"
                    className="eye"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {/* 4-segment strength meter */}
                <div className="meter">
                  <i
                    style={{
                      background:
                        score >= 1 ? (score < 2 ? 'var(--r)' : score < 3 ? 'var(--a)' : 'var(--g)') : '',
                    }}
                  />
                  <i
                    style={{
                      background:
                        score >= 2 ? (score < 3 ? 'var(--a)' : 'var(--g)') : '',
                    }}
                  />
                  <i style={{ background: score >= 3 ? 'var(--g)' : '' }} />
                  <i style={{ background: score >= 4 ? 'var(--g)' : '' }} />
                </div>
                <small className="mhint">
                  {password
                    ? `${strengthHints[score]} (Must include uppercase, lowercase, and number)`
                    : 'Minimum 8 characters with upper, lower, & number.'}
                </small>
                <span className="err" aria-live="polite">
                  {errors.pw}
                </span>
              </div>

              <div className="f">
                <label htmlFor="rc">Confirm password</label>
                <input
                  id="rc"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => handleInputChange('confirm', e.target.value)}
                  onBlur={() => handleBlur('confirm')}
                  aria-invalid={!!errors.confirm}
                />
                <span className="err" aria-live="polite">
                  {errors.confirm}
                </span>
              </div>

              <p className="fine">
                WarrantyVault requires email verification via a 6-digit one-time code to activate your vault.
              </p>

              <button className="btn sub" type="submit" disabled={submitting}>
                {submitting ? 'Creating vault…' : 'Create my vault'}
              </button>

              <p className="alt">
                Already have a vault?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="hover:text-[var(--ink)] underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* --- OTP VERIFICATION MODE --- */}
          {mode === 'otp' && (
            <form onSubmit={handleSubmit} noValidate>
              <h1>Enter 6-digit code</h1>
              <p className="lede">
                Enter the verification code dispatched to{' '}
                <strong className="text-[var(--ink)] font-mono">{otpEmail || email}</strong>.
              </p>

              <div className="f">
                <label htmlFor="rotp">6-Digit Code</label>
                <input
                  id="rotp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  className="!text-center !font-mono !text-2xl !tracking-[0.5em] !font-bold"
                  value={otpToken}
                  onChange={(e) => handleInputChange('otp', e.target.value)}
                  onBlur={() => handleBlur('otp')}
                  aria-invalid={!!errors.otp}
                  autoFocus
                />
                <span className="err" aria-live="polite">
                  {errors.otp}
                </span>
              </div>

              <button className="btn sub" type="submit" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify & Unlock Vault'}
              </button>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || submitting}
                  className={`underline cursor-pointer ${
                    resendCooldown > 0
                      ? 'text-[var(--mut)] cursor-not-allowed no-underline'
                      : 'text-[var(--ink)] hover:text-[var(--g)]'
                  }`}
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setOtpToken('');
                  }}
                  className="text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                >
                  ← Use different email
                </button>
              </div>
            </form>
          )}

          {/* --- FORGOT PASSWORD MODE --- */}
          {mode === 'forgot' && (
            <form onSubmit={handleSubmit} noValidate>
              <h1>Reset password</h1>
              <p className="lede">We’ll send a 6-digit recovery code to verify your identity.</p>

              <div className="f">
                <label htmlFor="fe">Email</label>
                <input
                  id="fe"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!errors.email}
                />
                <span className="err" aria-live="polite">
                  {errors.email}
                </span>
              </div>

              <button className="btn sub" type="submit" disabled={submitting}>
                {submitting ? 'Sending code…' : 'Send recovery code'}
              </button>

              <p className="alt">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="hover:text-[var(--ink)] cursor-pointer"
                >
                  ← Back to sign in
                </button>
              </p>
            </form>
          )}

          {/* --- RECOVERY NEW PASSWORD MODE --- */}
          {mode === 'recovery_password' && (
            <form onSubmit={handleSubmit} noValidate>
              <h1>Set new password</h1>
              <p className="lede">Choose a strong master key for your vault.</p>

              <div className="f">
                <label htmlFor="nwp">New Password</label>
                <div className="pwrow">
                  <input
                    id="nwp"
                    name="pw"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => handleInputChange('pw', e.target.value)}
                    onBlur={() => handleBlur('pw')}
                    aria-invalid={!!errors.pw}
                  />
                  <button
                    type="button"
                    className="eye"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="meter">
                  <i
                    style={{
                      background:
                        score >= 1 ? (score < 2 ? 'var(--r)' : score < 3 ? 'var(--a)' : 'var(--g)') : '',
                    }}
                  />
                  <i
                    style={{
                      background:
                        score >= 2 ? (score < 3 ? 'var(--a)' : 'var(--g)') : '',
                    }}
                  />
                  <i style={{ background: score >= 3 ? 'var(--g)' : '' }} />
                  <i style={{ background: score >= 4 ? 'var(--g)' : '' }} />
                </div>
                <small className="mhint">
                  {password
                    ? `${strengthHints[score]} (Must include uppercase, lowercase, and number)`
                    : 'Minimum 8 characters with upper, lower, & number.'}
                </small>
                <span className="err" aria-live="polite">
                  {errors.pw}
                </span>
              </div>

              <div className="f">
                <label htmlFor="nwpc">Confirm New Password</label>
                <input
                  id="nwpc"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => handleInputChange('confirm', e.target.value)}
                  onBlur={() => handleBlur('confirm')}
                  aria-invalid={!!errors.confirm}
                />
                <span className="err" aria-live="polite">
                  {errors.confirm}
                </span>
              </div>

              <button className="btn sub" type="submit" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update & Unlock Vault'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
