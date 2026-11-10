import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, WalletCards } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);

    try {
      await resetPassword(email);
      setSuccess('If an account exists for this email, a password recovery link will be sent. Check your inbox.');
    } catch (err) {
      setError(err.message || 'Unable to send the recovery email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-card auth-card--compact">
      <div className="auth-card__mobile-brand"><WalletCards size={22} /> Spendwise</div>
      <span className="auth-icon"><Mail size={23} /></span>
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h2>Forgot your password?</h2>
      <p className="auth-card__intro">Enter the email address associated with your account. We’ll send you a link to reset your password.</p>

      {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
      {success && <div className="form-alert form-alert--success" role="status">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Email address</span>
          <span className="form-input-wrap">
            <Mail size={18} />
            <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </span>
        </label>
        <button className="button button--primary button--full" type="submit" disabled={busy}>
          {busy ? 'Sending link...' : 'Send reset link'}
        </button>
      </form>

      <Link className="auth-back-link" to="/login"><ArrowLeft size={16} /> Back to sign in</Link>
    </section>
  );
}

export default ForgotPassword;
