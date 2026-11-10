import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, WalletCards } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function ResetPassword() {
  const { session, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!session) {
      setError('This recovery link is invalid or expired. Request a new password reset email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await updatePassword(password);
      setSuccess('Your password has been updated. You can now continue to your account.');
    } catch (err) {
      setError(err.message || 'Unable to update your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-card auth-card--compact">
      <div className="auth-card__mobile-brand"><WalletCards size={22} /> Spendwise</div>
      <span className="auth-icon"><LockKeyhole size={23} /></span>
      <span className="eyebrow">SECURE YOUR ACCOUNT</span>
      <h2>Set a new password</h2>
      <p className="auth-card__intro">Choose a new password with at least 8 characters.</p>

      {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
      {success && <div className="form-alert form-alert--success" role="status">{success} <Link to="/dashboard">Open dashboard</Link></div>}

      {!success && (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>New password</span>
            <span className="form-input-wrap">
              <LockKeyhole size={18} />
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
              <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <label className="form-field">
            <span>Confirm new password</span>
            <span className="form-input-wrap">
              <LockKeyhole size={18} />
              <input type="password" autoComplete="new-password" placeholder="Re-enter new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </span>
          </label>

          <button className="button button--primary button--full" type="submit" disabled={busy}>
            {busy ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      )}

      {!session && !success && (
        <Link className="auth-back-link" to="/forgot-password">Request another reset link</Link>
      )}
    </section>
  );
}

export default ResetPassword;
