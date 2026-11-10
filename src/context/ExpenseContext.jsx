import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ExpenseContext = createContext(null);
const EXPENSE_BUCKET = 'expense-receipts';
const PROFILE_BUCKET = 'profile-photos';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function getExtension(file) {
  const nameExtension = file.name?.split('.').pop()?.toLowerCase();
  if (nameExtension && nameExtension.length <= 5) return nameExtension;
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };
  return mimeMap[file.type] || 'jpg';
}

function validateImage(file, allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
  if (!file) return;
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP or HEIC image.');
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Image must be 5 MB or smaller.');
  }
}

async function createSignedUrl(bucket, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);
  if (error) {
    console.error(`Could not create signed URL for ${bucket}:`, error.message);
    return null;
  }
  return data.signedUrl;
}

async function attachExpenseImageUrls(expenses) {
  return Promise.all(expenses.map(async (expense) => ({
    ...expense,
    image_url: expense.image_path
      ? await createSignedUrl(EXPENSE_BUCKET, expense.image_path)
      : null,
  })));
}

async function uploadImage(bucket, userId, file) {
  if (!file) return null;
  validateImage(file);
  const filePath = `${userId}/${crypto.randomUUID()}.${getExtension(file)}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;
  return data.path;
}

export function ExpenseProvider({ children }) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [sharedExpenses, setSharedExpenses] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchExpenses = useCallback(async () => {
    if (!user?.id) {
      setExpenses([]);
      return [];
    }

    const { data, error: queryError } = await supabase
      .from('expenses')
      .select('id,user_id,amount,currency_code,category,expense_date,note,image_path,created_at')
      .eq('user_id', user.id)
      .is('workspace_id', null)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (queryError) throw queryError;
    const hydrated = await attachExpenseImageUrls(data || []);
    setExpenses(hydrated);
    return hydrated;
  }, [user?.id]);

  // Load expenses belonging to a shared workspace. This is deliberately
  // separate from fetchExpenses so Personal Mode remains isolated.
  const fetchSharedExpenses = useCallback(async (workspaceId) => {
    if (!user?.id || !workspaceId) {
      setSharedExpenses([]);
      return [];
    }

    const { data, error: queryError } = await supabase
      .from('expenses')
      .select('id,user_id,workspace_id,paid_by,amount,currency_code,category,expense_date,note,image_path,created_at')
      .eq('workspace_id', workspaceId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (queryError) throw queryError;

    // Shared receipt URLs are omitted until Storage RLS is configured for
    // workspace members. Expense records themselves remain accessible.
    const rows = (data || []).map((expense) => ({
      ...expense,
      image_url: null,
    }));

    setSharedExpenses(rows);
    return rows;
  }, [user?.id]);

  const addSharedExpense = useCallback(async (values, workspaceId, paidBy = user?.id) => {
    if (!user?.id) throw new Error('You must be signed in to add an expense.');
    if (!workspaceId) throw new Error('A shared workspace is required.');
    if (!paidBy) throw new Error('Select who paid for this expense.');
    if (values.imageFile) {
      throw new Error('Receipt uploads for shared expenses will be enabled after shared storage permissions are configured.');
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        user_id: user.id,
        workspace_id: workspaceId,
        paid_by: paidBy,
        amount: Number(values.amount),
        currency_code: values.currencyCode || profile?.preferred_currency || 'INR',
        category: values.category,
        expense_date: values.expenseDate,
        note: values.note?.trim() || null,
        image_path: null,
      };

      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert(payload)
        .select('id,user_id,workspace_id,paid_by,amount,currency_code,category,expense_date,note,image_path,created_at')
        .single();

      if (insertError) throw insertError;
      const hydrated = { ...data, image_url: null };
      setSharedExpenses((current) => [hydrated, ...current]);
      return hydrated;
    } finally {
      setSaving(false);
    }
  }, [user?.id, profile?.preferred_currency]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return null;
    }

    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('user_id,full_name,age,phone,profession,preferred_currency,avatar_path,created_at,updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (queryError) throw queryError;

    if (!data) {
      const initialProfile = {
        user_id: user.id,
        full_name: user.user_metadata?.full_name || '',
        age: null,
        phone: '',
        profession: '',
        preferred_currency: 'INR',
        avatar_path: null,
      };
      setProfile(initialProfile);
      return initialProfile;
    }

    const avatarUrl = data.avatar_path
      ? await createSignedUrl(PROFILE_BUCKET, data.avatar_path)
      : null;
    const hydrated = { ...data, avatar_url: avatarUrl };
    setProfile(hydrated);
    return hydrated;
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setExpenses([]);
      setSharedExpenses([]);
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchExpenses(), fetchProfile()]);
    } catch (err) {
      setError(err.message || 'Unable to load your expense data.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchExpenses, fetchProfile]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!user?.id) {
        if (active) {
          setExpenses([]);
          setSharedExpenses([]);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      if (active) setLoading(true);
      try {
        await Promise.all([fetchExpenses(), fetchProfile()]);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load your expense data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [user?.id, fetchExpenses, fetchProfile]);

  const addExpense = useCallback(async (values) => {
    if (!user?.id) throw new Error('You must be signed in to add an expense.');
    setSaving(true);
    setError('');

    let uploadedPath = null;
    try {
      if (values.imageFile) {
        uploadedPath = await uploadImage(EXPENSE_BUCKET, user.id, values.imageFile);
      }

      const payload = {
        user_id: user.id,
        amount: Number(values.amount),
        currency_code: values.currencyCode || profile?.preferred_currency || 'INR',
        category: values.category,
        expense_date: values.expenseDate,
        note: values.note?.trim() || null,
        image_path: uploadedPath,
      };

      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert(payload)
        .select('id,user_id,amount,currency_code,category,expense_date,note,image_path,created_at')
        .single();

      if (insertError) throw insertError;
      const [hydrated] = await attachExpenseImageUrls([data]);
      setExpenses((current) => [hydrated, ...current]);
      return hydrated;
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from(EXPENSE_BUCKET).remove([uploadedPath]);
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [user?.id, profile?.preferred_currency]);

  const updateExpense = useCallback(async (expenseId, values) => {
    if (!user?.id) throw new Error('You must be signed in to update an expense.');
    setSaving(true);
    setError('');

    let uploadedPath = null;
    try {
      const existing = expenses.find((item) => item.id === expenseId);
      let imagePath = existing?.image_path || null;

      if (values.removeImage && imagePath) {
        const oldPath = imagePath;
        const { error: removeError } = await supabase.storage
          .from(EXPENSE_BUCKET).remove([oldPath]);
        if (removeError) throw removeError;
        imagePath = null;
      }

      if (values.imageFile) {
        uploadedPath = await uploadImage(EXPENSE_BUCKET, user.id, values.imageFile);
        imagePath = uploadedPath;
      }

      const payload = {
        amount: Number(values.amount),
        currency_code: values.currencyCode || profile?.preferred_currency || 'INR',
        category: values.category,
        expense_date: values.expenseDate,
        note: values.note?.trim() || null,
        image_path: imagePath,
      };

      const { data, error: updateError } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', expenseId)
        .eq('user_id', user.id)
        .select('id,user_id,amount,currency_code,category,expense_date,note,image_path,created_at')
        .single();

      if (updateError) throw updateError;
      const [hydrated] = await attachExpenseImageUrls([data]);
      setExpenses((current) => current.map((item) => (
        item.id === expenseId ? hydrated : item
      )));

      if (uploadedPath && existing?.image_path) {
        await supabase.storage.from(EXPENSE_BUCKET).remove([existing.image_path]);
      }
      return hydrated;
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from(EXPENSE_BUCKET).remove([uploadedPath]);
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [user?.id, expenses, profile?.preferred_currency]);

  const deleteExpense = useCallback(async (expenseId) => {
    if (!user?.id) throw new Error('You must be signed in to delete an expense.');
    const existing = expenses.find((item) => item.id === expenseId);

    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('user_id', user.id);

    if (deleteError) throw deleteError;

    setExpenses((current) => current.filter((item) => item.id !== expenseId));

    if (existing?.image_path) {
      const { error: storageError } = await supabase.storage
        .from(EXPENSE_BUCKET)
        .remove([existing.image_path]);
      if (storageError) {
        console.warn('Expense deleted, but its image could not be removed:', storageError.message);
      }
    }
  }, [user?.id, expenses]);

  const saveProfile = useCallback(async (values) => {
    if (!user?.id) throw new Error('You must be signed in to update your profile.');
    setSaving(true);
    let uploadedPath = null;

    try {
      let avatarPath = profile?.avatar_path || null;

      if (values.avatarFile) {
        validateImage(values.avatarFile, ['image/jpeg', 'image/png', 'image/webp']);
        uploadedPath = await uploadImage(PROFILE_BUCKET, user.id, values.avatarFile);
        avatarPath = uploadedPath;
      }

      const payload = {
        user_id: user.id,
        full_name: values.fullName.trim(),
        age: values.age === '' || values.age == null ? null : Number(values.age),
        phone: values.phone.trim() || null,
        profession: values.profession.trim() || null,
        preferred_currency: values.preferredCurrency || 'INR',
        avatar_path: avatarPath,
        updated_at: new Date().toISOString(),
      };

      const { data, error: upsertError } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (upsertError) throw upsertError;

      const avatarUrl = data.avatar_path
        ? await createSignedUrl(PROFILE_BUCKET, data.avatar_path)
        : null;
      const hydrated = { ...data, avatar_url: avatarUrl };
      setProfile(hydrated);

      if (uploadedPath && profile?.avatar_path) {
        await supabase.storage.from(PROFILE_BUCKET).remove([profile.avatar_path]);
      }
      return hydrated;
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from(PROFILE_BUCKET).remove([uploadedPath]);
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [user?.id, profile]);

  const value = useMemo(() => ({
    expenses,
    sharedExpenses,
    profile,
    loading,
    saving,
    error,
    refresh,
    fetchExpenses,
    fetchSharedExpenses,
    addSharedExpense,
    fetchProfile,
    addExpense,
    updateExpense,
    deleteExpense,
    saveProfile,
  }), [
    expenses, sharedExpenses, profile, loading, saving, error, refresh,
    fetchExpenses, fetchSharedExpenses, addSharedExpense, fetchProfile, addExpense, updateExpense,
    deleteExpense, saveProfile,
  ]);

  return (
    <ExpenseContext.Provider value={value}>
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used inside ExpenseProvider');
  }
  return context;
}
