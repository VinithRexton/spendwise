import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound, WalletCards } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const data = await signUp(form);
      if (data.session) {
        navigate('/dashboard', { replace: true });
      } else {
        setSuccess('Account created. Check your email for the confirmation link before signing in.');
      }
    } catch (err) {
      setError(err.message || 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-card">
      <div className="auth-card__mobile-brand"><WalletCards size={22} /> Spendwise</div>
      <span className="eyebrow">GET STARTED</span>
      <h2>Create your account</h2>
      <p className="auth-card__intro">Set up your account to keep your expenses in one place.</p>

      {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
      {success && <div className="form-alert form-alert--success" role="status">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Full name</span>
          <span className="form-input-wrap">
            <UserRound size={18} />
            <input name="fullName" type="text" autoComplete="name" placeholder="Your full name" value={form.fullName} onChange={handleChange} required maxLength={80} />
          </span>
        </label>

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
            <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} required minLength={8} />
            <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <label className="form-field">
          <span>Confirm password</span>
          <span className="form-input-wrap">
            <LockKeyhole size={18} />
            <input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange} required />
          </span>
        </label>

        <button className="button button--primary button--full" type="submit" disabled={busy}>
          {busy ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="auth-card__switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </section>
  );
}

export default Signup;
