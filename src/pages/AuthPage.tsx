import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateUserName, validatePassword, validateEmail } from '../lib/validation';

type AuthMode = 'login' | 'register' | 'forgot';

interface AuthPageProps {
  initialMode?: AuthMode;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPassword } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const next = searchParams.get('next');
      const target = next && next.startsWith('/') ? next : '/dashboard';
      navigate(target, { replace: true });
    }
  }, [user, navigate, searchParams]);

  // Sync mode with prop change
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Vault Combination Dial State
  const [rot, setRot] = useState(0);
  const [unlocked, setUnlocked] = useState(false);

  const turnDial = () => {
    setRot((prev) => prev + 23);
  };

  // Reset errors and notifications when switching modes
  useEffect(() => {
    setUnlocked(false);
    setServerError(null);
    setSuccessNotice(null);
    setErrors({});
    setTouched({});
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

  // Strict Validation Rules
  const validateField = (field: string, val?: string): string => {
    if (field === 'name') {
      const v = (val !== undefined ? val : name).trim();
      const res = validateUserName(v);
      if (!res.valid && res.error) return res.error;
    }
    if (field === 'email') {
      const v = (val !== undefined ? val : email).trim();
      const res = validateEmail(v);
      if (!res.valid && res.error) return res.error;
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
    if (field === 'pw') {
      setPassword(value);
      if (touched['confirm'] && confirmPassword) {
        const cErr = value !== confirmPassword ? 'Passwords don’t match yet.' : '';
        setErrors((prev) => ({ ...prev, confirm: cErr }));
      }
    }
    if (field === 'confirm') setConfirmPassword(value);

    // Live validation if touched or has error
    if (touched[field] || errors[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessNotice(null);

    // Validate fields
    const newErrors: Record<string, string> = {};
    if (mode === 'register') {
      const nameErr = validateField('name', name);
      if (nameErr) newErrors.name = nameErr;
    }
    const emailErr = validateField('email', email);
    if (emailErr) newErrors.email = emailErr;

    if (mode !== 'forgot') {
      const pwErr = validateField('pw', password);
      if (pwErr) newErrors.pw = pwErr;
    }
    if (mode === 'register') {
      const confErr = validateField('confirm', confirmPassword);
      if (confErr) newErrors.confirm = confErr;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ name: true, email: true, pw: true, confirm: true });
      return;
    }

    setSubmitting(true);
    setRot((prev) => prev + 180);

    try {
      if (mode === 'login') {
        const res = await signIn(email, password);
        if (res.error) {
          setServerError(res.error);
          setSubmitting(false);
          return;
        }

        setUnlocked(true);
        setTimeout(() => {
          const next = searchParams.get('next');
          const target = next && next.startsWith('/') ? next : '/dashboard';
          navigate(target);
        }, 800);
      } else if (mode === 'register') {
        const res = await signUp(email, password, name);
        if (res.error) {
          setServerError(res.error);
          setSubmitting(false);
          return;
        }

        // Account registered!
        if (res.sessionCreated) {
          setUnlocked(true);
          setTimeout(() => {
            const next = searchParams.get('next');
            const target = next && next.startsWith('/') ? next : '/dashboard';
            navigate(target);
          }, 800);
        } else {
          // If confirmation is required by Supabase, switch to login tab with clean notice
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          setSuccessNotice('Account registered successfully! Please sign in with your email and password.');
          setSubmitting(false);
        }
      } else if (mode === 'forgot') {
        const res = await resetPassword(email);
        if (res.error) {
          setServerError(res.error);
          setSubmitting(false);
          return;
        }

        setSuccessNotice('A secure recovery link has been dispatched to your email address.');
        setSubmitting(false);
      }
    } catch (err: any) {
      setServerError(err.message || 'An unexpected error occurred');
      setSubmitting(false);
    }
  };

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
      text: 'Create your account first, then log in to manage your warranties, receipts, and alert schedules.',
    },
    forgot: {
      eyebrow: 'Lost the key',
      heading: (
        <>
          We’ll send <em>a new one.</em>
        </>
      ),
      text: 'Enter your registered email and we’ll send a link to reset your password.',
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

          {/* Success Notice */}
          {successNotice && (
            <div
              className="mb-4 p-3 border border-[var(--g)] bg-[var(--g)]/10 text-[var(--g)] text-xs font-mono"
              role="status"
            >
              {successNotice}
            </div>
          )}

          {/* --- LOGIN MODE --- */}
          {mode === 'login' && (
            <form onSubmit={handleSubmit} noValidate>
              <h1>Sign in</h1>
              <p className="lede">Pick up where you left off.</p>

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

              <button className="btn sub" type="submit" disabled={submitting}>
                {submitting ? 'Checking…' : 'Unlock vault'}
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
                    : 'Minimum 8 characters with uppercase, lowercase, and number.'}
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

          {/* --- FORGOT PASSWORD MODE --- */}
          {mode === 'forgot' && (
            <form onSubmit={handleSubmit} noValidate>
              <h1>Reset password</h1>
              <p className="lede">We’ll send a link to reset your master password.</p>

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
                {submitting ? 'Sending link…' : 'Send reset link'}
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
        </div>
      </div>
    </section>
  );
};
