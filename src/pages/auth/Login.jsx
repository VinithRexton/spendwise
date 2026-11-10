import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, WalletCards } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await signIn(form);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-card">
      <div className="auth-card__mobile-brand"><WalletCards size={22} /> Spendwise</div>
      <span className="eyebrow">WELCOME BACK</span>
      <h2>Sign in to your account</h2>
      <p className="auth-card__intro">Enter your details to continue tracking your expenses.</p>

      {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Email address</span>
          <span className="form-input-wrap">
            <Mail size={18} />
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
          </span>
        </label>

        <label className="form-field">
          <span>Password</span>
          <span className="form-input-wrap">
            <LockKeyhole size={18} />
            <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={handleChange} required />
            <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <div className="auth-form__meta">
          <span />
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button className="button button--primary button--full" type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="auth-card__switch">Don’t have an account? <Link to="/signup">Create account</Link></p>
    </section>
  );
}

export default Login;
