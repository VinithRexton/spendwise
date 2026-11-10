
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

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load the signed-in user's workspace and members.
  const refreshWorkspace = useCallback(async () => {
    if (!user?.id) {
      setWorkspace(null);
      setMembers([]);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError('');

    try {
      const {
        data: memberships,
        error: membershipError,
      } = await supabase
        .from('workspace_members')
        .select('workspace_id,user_id,role,joined_at')
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;

      if (!memberships?.length) {
        setWorkspace(null);
        setMembers([]);
        return null;
      }

      const workspaceIds = memberships.map(
        (item) => item.workspace_id
      );

      const {
        data: workspaces,
        error: workspaceError,
      } = await supabase
        .from('workspaces')
        .select('id,name,workspace_type,owner_id,created_at')
        .in('id', workspaceIds);

      if (workspaceError) throw workspaceError;

      if (!workspaces?.length) {
        setWorkspace(null);
        setMembers([]);
        return null;
      }

      // Currently one workspace per account is supported.
      if (workspaces.length > 1) {
        throw new Error(
          'Your account is connected to multiple workspaces.'
        );
      }

      const currentWorkspace = workspaces[0];

      const {
        data: workspaceMembers,
        error: membersError,
      } = await supabase
        .from('workspace_members')
        .select('workspace_id,user_id,role,joined_at')
        .eq('workspace_id', currentWorkspace.id)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      setWorkspace(currentWorkspace);
      setMembers(workspaceMembers || []);

      return currentWorkspace;
    } catch (err) {
      setError(
        err.message || 'Unable to load your shared workspace.'
      );

      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Create a shared workspace.
  
const createWorkspace = useCallback(
  async (name = 'Shared Workspace') => {
    setSaving(true);
    setError('');

    try {
      const {
        data: { user: authenticatedUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authenticatedUser) {
        throw new Error('Please sign in first.');
      }

      if (authenticatedUser.id !== user?.id) {
        throw new Error('Authenticated user ID mismatch.');
      }

      if (workspace) {
        throw new Error(
          'You already belong to a shared workspace.'
        );
      }

      const cleanName = name.trim() || 'Shared Workspace';

      const payload = {
        name: cleanName,
        workspace_type: 'shared',
        owner_id: authenticatedUser.id,
      };

      // Insert without requesting the inserted row.
      // This avoids requiring SELECT visibility in the INSERT response.
      const { error: createError } = await supabase
        .from('workspaces')
        .insert(payload);

      if (createError) throw createError;

      // The AFTER INSERT trigger creates the owner membership.
      // Load the workspace through the membership relationship.
      const createdWorkspace = await refreshWorkspace();

      if (!createdWorkspace) {
        throw new Error(
          'Workspace was created, but its membership could not be loaded.'
        );
      }

      return createdWorkspace;
    } catch (err) {
      console.error('Workspace creation failed:', {
        code: err.code,
        message: err.message,
        details: err.details,
        hint: err.hint,
      });

      setError(
        err.message || 'Unable to create your shared workspace.'
      );

      throw err;
    } finally {
      setSaving(false);
    }
  },
  [user?.id, workspace, refreshWorkspace]
);


  // Load workspace when the authenticated user changes.
  useEffect(() => {
    let active = true;

    const loadWorkspace = async () => {
      try {
        await refreshWorkspace();
      } catch (err) {
        if (active) {
          console.error(
            'Workspace loading failed:',
            err.message
          );
        }
      }
    };

    loadWorkspace();

    return () => {
      active = false;
    };
  }, [refreshWorkspace]);

  const value = useMemo(
    () => ({
      workspace,
      members,
      loading,
      saving,
      error,

      hasWorkspace: Boolean(workspace),

      isOwner: Boolean(
        workspace &&
        workspace.owner_id === user?.id
      ),

      refreshWorkspace,
      createWorkspace,
    }),
    [
      workspace,
      members,
      loading,
      saving,
      error,
      user?.id,
      refreshWorkspace,
      createWorkspace,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// Custom hook.
export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      'useWorkspace must be used inside WorkspaceProvider'
    );
  }

  return context;
}
