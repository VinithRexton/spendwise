import { Outlet } from 'react-router-dom';
import { WalletCards } from 'lucide-react';

function AuthLayout() {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-brand">
          <span className="auth-brand__mark"><WalletCards size={23} /></span>
          <span>Spendwise</span>
        </div>

        <div className="auth-aside__content">
          <span className="eyebrow eyebrow--light">YOUR MONEY, IN FOCUS</span>
          <h1>Make every expense count.</h1>
          <p>Understand your daily spending and build better monthly habits with one clear view of your money.</p>
          <div className="auth-aside__dots" aria-hidden="true">
            <span /><span /><span />
          </div>
        </div>

        <p className="auth-aside__footer">Daily &amp; Monthly Expense Tracker</p>
      </aside>

      <main className="auth-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AuthLayout;
