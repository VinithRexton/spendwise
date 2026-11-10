import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowUpRight, BarChart3, CalendarDays,
  Camera, Car, Check, ChevronDown, CircleHelp, Clapperboard, Coffee,
  CreditCard, FileText, Film, Gift, GraduationCap, HeartPulse, House,
  LogOut, Menu, MoreHorizontal, Pencil, Plane, Plus, Receipt,
  Search, Settings, ShoppingBag, ShoppingCart, Trash2, Utensils,
  Wallet, X, UserRound, BriefcaseBusiness, Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useWorkspace } from '../../context/WorkspaceContext';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

const CATEGORY_GROUPS = [
  {
    label: 'Essential',
    items: [
      ['Housing', House], ['Utilities', Receipt], ['Food & Groceries', ShoppingCart],
      ['Transportation', Car], ['Healthcare', HeartPulse], ['Insurance', CreditCard],
      ['Debt Payments', Wallet], ['Childcare & Family Care', UserRound],
    ],
  },
  {
    label: 'Discretionary',
    items: [
      ['Dining Out & Entertainment', Utensils], ['Subscriptions & Streaming', Film],
      ['Shopping & Personal Care', ShoppingBag], ['Travel', Plane], ['Gifts & Donations', Gift],
    ],
  },
  {
    label: 'Financial goals',
    items: [['Savings & Investments', BarChart3]],
  },
  {
    label: 'Other',
    items: [['Education', GraduationCap], ['Other', CircleHelp]],
  },
];

const CATEGORY_ICON = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((group) => group.items.map(([name, Icon]) => [name, Icon])),
);

const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function formatMoney(amount, currencyCode) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode || 'INR',
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currencyCode || 'INR'} ${Number(amount || 0).toFixed(2)}`;
  }
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateString}T00:00:00`));
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="expense-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`expense-modal${wide ? ' expense-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="expense-modal__header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function ImagePicker({ file, currentUrl, onChange, onRemove, label = 'Attach image' }) {
  const inputRef = useRef(null);
  const preview = file ? URL.createObjectURL(file) : currentUrl;

  return (
    <div className="image-picker">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        hidden
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      {preview ? (
        <div className="image-picker__preview">
          <img src={preview} alt="Selected upload preview" />
          <div className="image-picker__actions">
            <button type="button" className="button button--soft" onClick={() => inputRef.current?.click()}><Camera size={16} /> Change</button>
            <button type="button" className="icon-button icon-button--danger" onClick={onRemove} aria-label="Remove image"><Trash2 size={17} /></button>
          </div>
        </div>
      ) : (
        <button type="button" className="image-picker__empty" onClick={() => inputRef.current?.click()}>
          <span><ImageIcon size={20} /></span>
          <strong>{label}</strong>
          <small>JPEG, PNG, WebP or HEIC · up to 5 MB</small>
        </button>
      )}
    </div>
  );
}

function ExpenseForm({ initial, currencyCode, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    amount: initial?.amount ?? '',
    category: initial?.category ?? 'Food & Groceries',
    expenseDate: initial?.expense_date ?? todayISO(),
    note: initial?.note ?? '',
    currencyCode: initial?.currency_code ?? currencyCode,
  });
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState('');

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (Number(form.amount) > 999999999) {
      setError('Amount is too large.');
      return;
    }

    try {
      await onSave({ ...form, imageFile, removeImage });
    } catch (err) {
      setError(err.message || 'Unable to save this expense.');
    }
  };

  return (
    <form className="expense-form" onSubmit={submit}>
      {error && <div className="dashboard-alert dashboard-alert--error" role="alert">{error}</div>}
      <div className="expense-form__amount">
        <label htmlFor="expense-amount">Amount</label>
        <div className="expense-form__amount-input">
          <select aria-label="Expense currency" value={form.currencyCode} onChange={(event) => setField('currencyCode', event.target.value)}>
            {CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} {currency.symbol}</option>)}
          </select>
          <input id="expense-amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={(event) => setField('amount', event.target.value)} required />
        </div>
      </div>

      <label className="dashboard-field">
        <span>Category</span>
        <select value={form.category} onChange={(event) => setField('category', event.target.value)} required>
          {CATEGORY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map(([name]) => <option key={name} value={name}>{name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="dashboard-field">
        <span>Date</span>
        <input type="date" value={form.expenseDate} max={todayISO()} onChange={(event) => setField('expenseDate', event.target.value)} required />
      </label>

      <label className="dashboard-field">
        <span>Note <small>Optional</small></span>
        <textarea rows="3" maxLength="500" placeholder="What was this expense for?" value={form.note} onChange={(event) => setField('note', event.target.value)} />
      </label>

      <div className="dashboard-field">
        <span>Receipt or expense photo <small>Optional</small></span>
        <ImagePicker
          file={imageFile}
          currentUrl={removeImage ? null : initial?.image_url}
          onChange={(file) => { setImageFile(file); setRemoveImage(false); }}
          onRemove={() => { setImageFile(null); setRemoveImage(true); }}
        />
      </div>

      <footer className="expense-form__footer">
        <button className="button button--outline" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : initial ? 'Save changes' : 'Save expense'}
        </button>
      </footer>
    </form>
  );
}

function ProfileForm({ profile, user, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    fullName: profile?.full_name || user?.user_metadata?.full_name || '',
    age: profile?.age ?? '',
    phone: profile?.phone || '',
    profession: profile?.profession || '',
    preferredCurrency: profile?.preferred_currency || 'INR',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.fullName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (form.age !== '' && (Number(form.age) < 1 || Number(form.age) > 120)) {
      setError('Enter an age between 1 and 120.');
      return;
    }
    try {
      await onSave({ ...form, avatarFile });
    } catch (err) {
      setError(err.message || 'Unable to save your profile.');
    }
  };

  return (
    <form className="expense-form" onSubmit={submit}>
      {error && <div className="dashboard-alert dashboard-alert--error" role="alert">{error}</div>}
      <div className="profile-photo-field">
        <div className="profile-photo profile-photo--large">
          {avatarFile
            ? <img src={URL.createObjectURL(avatarFile)} alt="Profile preview" />
            : profile?.avatar_url
              ? <img src={profile.avatar_url} alt="Profile" />
              : <UserRound size={30} />}
        </div>
        <label className="button button--soft profile-photo-field__button">
          <Camera size={16} /> Upload photo
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
        </label>
        <small>JPEG, PNG or WebP · up to 5 MB</small>
      </div>

      <label className="dashboard-field">
        <span>Full name</span>
        <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} maxLength={100} required />
      </label>
      <div className="dashboard-form-grid">
        <label className="dashboard-field">
          <span>Age</span>
          <input type="number" min="1" max="120" placeholder="e.g. 28" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />
        </label>
        <label className="dashboard-field">
          <span>Phone number</span>
          <input type="tel" autoComplete="tel" placeholder="+91..." value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} maxLength={25} />
        </label>
      </div>
      <label className="dashboard-field">
        <span>Profession</span>
        <input placeholder="e.g. Software Engineer" value={form.profession} onChange={(event) => setForm({ ...form, profession: event.target.value })} maxLength={100} />
      </label>
      <label className="dashboard-field">
        <span>Preferred currency</span>
        <select value={form.preferredCurrency} onChange={(event) => setForm({ ...form, preferredCurrency: event.target.value })}>
          {CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.name} ({currency.code} · {currency.symbol})</option>)}
        </select>
      </label>
      <p className="dashboard-hint">Changing your preferred currency affects new expenses and the dashboard currency filter. It does not convert existing transactions.</p>
      <footer className="expense-form__footer">
        <button className="button button--outline" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
      </footer>
    </form>
  );
}

function SummaryCard({ label, amount, detail, icon: Icon, tone }) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <div className="summary-card__top">
        <span>{label}</span>
        <span className="summary-card__icon"><Icon size={19} /></span>
      </div>
      <strong>{amount}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Dashboard() {
  const { user, signOut } = useAuth();
  const {
    expenses, sharedExpenses, profile, loading, saving,
    addExpense, addSharedExpense, updateExpense, deleteExpense, saveProfile, refresh, fetchSharedExpenses,
  } = useExpenses();
  const { workspace, members, loading: workspaceLoading, saving: workspaceSaving, createWorkspace } = useWorkspace();

  const [activeModal, setActiveModal] = useState(null);
  const [activeMode, setActiveMode] = useState('personal');
  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(profile?.preferred_currency || 'INR');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [pageError, setPageError] = useState('');

  const currencyCode = selectedCurrency || profile?.preferred_currency || 'INR';
  const isSharedMode = activeMode === 'shared';
  const visibleExpenses = isSharedMode ? sharedExpenses : expenses;

  useEffect(() => {
    if (isSharedMode && workspace?.id) {
      fetchSharedExpenses(workspace.id).catch((err) => {
        setPageError(err.message || 'Unable to load shared expenses.');
      });
    }
  }, [isSharedMode, workspace?.id, fetchSharedExpenses]);
  const now = new Date();
  const currentMonth = monthKey(now);
  const today = todayISO();

  const currencyExpenses = useMemo(
    () => visibleExpenses.filter((expense) => expense.currency_code === currencyCode),
    [visibleExpenses, currencyCode],
  );

  const monthExpenses = useMemo(
    () => currencyExpenses.filter((expense) => expense.expense_date?.slice(0, 7) === currentMonth),
    [currencyExpenses, currentMonth],
  );

  const todayExpenses = useMemo(
    () => currencyExpenses.filter((expense) => expense.expense_date === today),
    [currencyExpenses, today],
  );

  const monthTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const todayTotal = todayExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const categoryTotals = useMemo(() => {
    const totals = monthExpenses.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
      return acc;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]);

  const recentExpenses = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return [...currencyExpenses]
      .filter((item) => !normalized
        || item.category.toLowerCase().includes(normalized)
        || (item.note || '').toLowerCase().includes(normalized))
      .sort((a, b) => `${b.expense_date}${b.created_at}`.localeCompare(`${a.expense_date}${a.created_at}`))
      .slice(0, 8);
  }, [currencyExpenses, search]);

  const currencySymbol = CURRENCIES.find((item) => item.code === currencyCode)?.symbol || currencyCode;

  const handleAdd = async (values) => {
    if (isSharedMode) {
      if (!workspace?.id) throw new Error('Create a Shared Workspace before adding shared expenses.');
      await addSharedExpense(values, workspace.id, user.id);
    } else {
      await addExpense(values);
    }
    setActiveModal(null);
    setNotice(isSharedMode ? 'Shared expense added successfully.' : 'Expense added successfully.');
  };

  const handleUpdate = async (values) => {
    await updateExpense(editingExpense.id, values);
    setEditingExpense(null);
    setActiveModal(null);
    setNotice('Expense updated successfully.');
  };

  const handleDelete = async (expense) => {
    const confirmed = window.confirm(`Delete this ${formatMoney(expense.amount, expense.currency_code)} expense?`);
    if (!confirmed) return;
    setPageError('');
    try {
      await deleteExpense(expense.id);
      setNotice('Expense deleted.');
    } catch (err) {
      setPageError(err.message || 'Unable to delete expense.');
    }
  };

  const handleProfileSave = async (values) => {
    const updated = await saveProfile(values);
    setSelectedCurrency(updated.preferred_currency || 'INR');
    setActiveModal(null);
    setNotice('Profile updated successfully.');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      setPageError(err.message || 'Unable to sign out.');
    }
  };

  const greetingName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';

  return (
    <div className="dashboard-app">
      <aside className={`dashboard-sidebar${mobileMenuOpen ? ' is-open' : ''}`}>
        <div className="dashboard-brand">
          <span className="dashboard-brand__mark"><Wallet size={22} /></span>
          <span>Spendwise</span>
          <button className="icon-button dashboard-sidebar__close" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <nav className="dashboard-nav" aria-label="Main navigation">
          <span className="dashboard-nav__label">WORKSPACE</span>
          <a className="dashboard-nav__item is-active" href="#overview" onClick={() => setMobileMenuOpen(false)}><BarChart3 size={18} /> Overview</a>
          <a className="dashboard-nav__item" href="#transactions" onClick={() => setMobileMenuOpen(false)}><Receipt size={18} /> Transactions</a>
          <a className="dashboard-nav__item" href="#categories" onClick={() => setMobileMenuOpen(false)}><Activity size={18} /> Categories</a>
          <span className="dashboard-nav__label dashboard-nav__label--spaced">PREFERENCES</span>
          <button className="dashboard-nav__item" type="button" onClick={() => { setActiveModal('profile'); setMobileMenuOpen(false); }}><Settings size={18} /> Profile & settings</button>
        </nav>
        <div className="dashboard-sidebar__bottom">
          <div className="dashboard-sidebar__tip">
            <span><CalendarDays size={18} /></span>
            <strong>Stay on top of spending</strong>
            <p>Small daily check-ins make monthly budgets easier to manage.</p>
          </div>
          <button className="dashboard-nav__item dashboard-nav__logout" type="button" onClick={handleSignOut}><LogOut size={18} /> Sign out</button>
        </div>
      </aside>

      {mobileMenuOpen && <button className="dashboard-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="icon-button dashboard-menu-toggle" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="dashboard-topbar__breadcrumb"><span>{isSharedMode ? 'Shared Workspace' : 'Personal Workspace'}</span><b>/</b><strong>Overview</strong></div>
          <div className="dashboard-topbar__actions">
            <button className="dashboard-currency-select" type="button" onClick={() => setActiveModal('profile')} title="Change preferred currency">
              {currencyCode} <ChevronDown size={15} />
            </button>
            <button className="dashboard-profile-button" type="button" onClick={() => setActiveModal('profile')}>
              <span className="profile-photo">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={18} />}
              </span>
              <span>{greetingName}</span>
            </button>
          </div>
        </header>

        <div className="dashboard-content" id="overview">
          <div className="dashboard-mode-switch" role="group" aria-label="Expense mode">
            <button type="button" className={`button ${!isSharedMode ? 'button--primary' : 'button--outline'}`} aria-pressed={!isSharedMode} onClick={() => setActiveMode('personal')}>Personal Mode</button>
            <button type="button" className={`button ${isSharedMode ? 'button--primary' : 'button--outline'}`} aria-pressed={isSharedMode} onClick={() => setActiveMode('shared')}>Shared Mode</button>
          </div>

          {isSharedMode && !workspace && (
            <section className="dashboard-panel shared-workspace-setup">
              <div className="dashboard-panel__heading">
                <div><h2>Create your Shared Workspace</h2><p>Start recording expenses visible to workspace members.</p></div>
              </div>
              <button className="button button--primary" type="button" disabled={workspaceSaving || workspaceLoading} onClick={async () => {
                setPageError('');
                try {
                  await createWorkspace('Shared Workspace');
                  setNotice('Shared Workspace created successfully.');
                } catch (err) {
                  setPageError(err.message || 'Unable to create your workspace.');
                }
              }}>{workspaceSaving ? 'Creating...' : 'Create Shared Workspace'}</button>
            </section>
          )}

          {isSharedMode && workspace && (
            <div className="dashboard-workspace-meta">
              <strong>{workspace.name}</strong>
              <span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
            </div>
          )}

          <div className="dashboard-heading">
            <div>
              <span className="eyebrow">{isSharedMode ? 'SHARED FINANCIAL OVERVIEW' : 'YOUR FINANCIAL OVERVIEW'}</span>
              <h1>Good {now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening'}, {greetingName.split(' ')[0]}.</h1>
              <p>{isSharedMode ? 'A combined view of expenses recorded in your Shared Workspace.' : 'Here’s what’s happening with your money.'}</p>
            </div>
            <button className="button button--primary dashboard-add-button" type="button" disabled={isSharedMode && !workspace} onClick={() => { setEditingExpense(null); setActiveModal('expense'); }}>
              <Plus size={18} /> {isSharedMode ? 'Add shared expense' : 'Add expense'}
            </button>
          </div>

          {(notice || pageError) && (
            <div className={`dashboard-alert ${pageError ? 'dashboard-alert--error' : 'dashboard-alert--success'}`} role="status">
              <span>{pageError || notice}</span>
              <button className="icon-button" type="button" onClick={() => { setNotice(''); setPageError(''); }} aria-label="Dismiss message"><X size={16} /></button>
            </div>
          )}

          <section className="summary-grid" aria-label="Spending summary">
            <SummaryCard label="Spent this month" amount={formatMoney(monthTotal, currencyCode)} detail={`${getMonthLabel(now)} · ${monthExpenses.length} transactions`} icon={Wallet} tone="primary" />
            <SummaryCard label="Spent today" amount={formatMoney(todayTotal, currencyCode)} detail={`${todayExpenses.length} transactions today`} icon={ArrowUpRight} tone="blue" />
            <SummaryCard label="Average per transaction" amount={formatMoney(monthExpenses.length ? monthTotal / monthExpenses.length : 0, currencyCode)} detail="Current month" icon={Activity} tone="peach" />
          </section>

          <section className="dashboard-panel-grid">
            <article className="dashboard-panel dashboard-panel--categories" id="categories">
              <div className="dashboard-panel__heading">
                <div><h2>Spending by category</h2><p>{getMonthLabel(now)}</p></div>
                <span className="dashboard-panel__badge">{monthExpenses.length} items</span>
              </div>
              {loading ? <div className="dashboard-skeleton" /> : categoryTotals.length ? (
                <div className="category-list">
                  {categoryTotals.slice(0, 6).map(([category, total]) => {
                    const Icon = CATEGORY_ICON[category] || CircleHelp;
                    const percentage = monthTotal ? (total / monthTotal) * 100 : 0;
                    return (
                      <div className="category-row" key={category}>
                        <span className="category-row__icon"><Icon size={17} /></span>
                        <div className="category-row__main">
                          <div className="category-row__meta"><strong>{category}</strong><span>{formatMoney(total, currencyCode)}</span></div>
                          <div className="category-progress"><span style={{ width: `${percentage}%` }} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="dashboard-empty"><span><BarChart3 size={22} /></span><strong>No category data yet</strong><p>Add an expense to see your spending breakdown.</p></div>}
            </article>

            <article className="dashboard-panel dashboard-panel--insight">
              <div className="dashboard-panel__heading"><div><h2>Monthly snapshot</h2><p>A quick look at this month</p></div><CalendarDays size={19} /></div>
              <div className="snapshot-total"><span>Total recorded</span><strong>{formatMoney(monthTotal, currencyCode)}</strong></div>
              <div className="snapshot-stat"><span>Transactions</span><strong>{monthExpenses.length}</strong></div>
              <div className="snapshot-stat"><span>Top category</span><strong>{categoryTotals[0]?.[0] || '—'}</strong></div>
              <div className="snapshot-stat"><span>Daily average</span><strong>{formatMoney(monthTotal / Math.max(now.getDate(), 1), currencyCode)}</strong></div>
            </article>
          </section>

          <section className="dashboard-panel transactions-panel" id="transactions">
            <div className="dashboard-panel__heading transactions-panel__heading">
              <div><h2>Recent transactions</h2><p>Your latest expense activity</p></div>
              <label className="dashboard-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" /></label>
            </div>

            {loading ? <div className="dashboard-skeleton dashboard-skeleton--table" /> : recentExpenses.length ? (
              <>
                <div className="transaction-list">
                  {recentExpenses.map((expense) => {
                    const Icon = CATEGORY_ICON[expense.category] || CircleHelp;
                    return (
                      <article className="transaction-row" key={expense.id}>
                        <span className="transaction-row__icon">{expense.image_url ? <img src={expense.image_url} alt="" /> : <Icon size={19} />}</span>
                        <div className="transaction-row__details">
                          <strong>{expense.category}</strong>
                          <span>{expense.note || 'No note'} · {formatDate(expense.expense_date)}{isSharedMode ? ` · ${expense.paid_by === user.id ? 'Paid by you' : 'Paid by workspace member'}` : ''}</span>
                        </div>
                        <strong className="transaction-row__amount">{formatMoney(expense.amount, expense.currency_code)}</strong>
                        <div className="transaction-row__actions">
                          {expense.image_url && <a href={expense.image_url} target="_blank" rel="noreferrer" className="icon-button" aria-label="View expense image"><ImageIcon size={16} /></a>}
                          {!isSharedMode && <button type="button" className="icon-button" onClick={() => { setEditingExpense(expense); setActiveModal('expense'); }} aria-label="Edit expense"><Pencil size={16} /></button>}
                          {!isSharedMode && <button type="button" className="icon-button icon-button--danger" onClick={() => handleDelete(expense)} aria-label="Delete expense"><Trash2 size={16} /></button>}
                        </div>
                      </article>
                    );
                  })}
                </div>
                <p className="transactions-panel__footnote">Showing up to 8 recent transactions in {currencyCode}.</p>
              </>
            ) : (
              <div className="dashboard-empty"><span><Receipt size={22} /></span><strong>{search ? 'No matching expenses' : 'No expenses yet'}</strong><p>{search ? 'Try another search term.' : isSharedMode ? 'Add a shared expense to start tracking workspace spending.' : 'Add your first expense to start tracking your spending.'}</p>{!search && <button className="button button--primary" type="button" onClick={() => { setEditingExpense(null); setActiveModal('expense'); }}><Plus size={17} /> {isSharedMode ? 'Add shared expense' : 'Add your first expense'}</button>}</div>
            )}
          </section>

          <footer className="dashboard-footer">Spendwise <span>·</span> Daily &amp; Monthly Expense Tracker</footer>
        </div>
      </main>

      {activeModal === 'expense' && (
        <Modal title={editingExpense ? 'Edit expense' : 'Add an expense'} subtitle={isSharedMode ? 'Record the expense and who paid.' : 'Record the details of your transaction.'} onClose={() => { setActiveModal(null); setEditingExpense(null); }}>
          <ExpenseForm
            initial={editingExpense}
            currencyCode={profile?.preferred_currency || 'INR'}
            onSave={editingExpense ? handleUpdate : handleAdd}
            onCancel={() => { setActiveModal(null); setEditingExpense(null); }}
            saving={saving}
          />
        </Modal>
      )}

      {activeModal === 'profile' && (
        <Modal title="Your profile" subtitle="Manage your personal details and preferences." onClose={() => setActiveModal(null)}>
          <ProfileForm
            profile={profile}
            user={user}
            onSave={handleProfileSave}
            onCancel={() => setActiveModal(null)}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}

export default Dashboard;
