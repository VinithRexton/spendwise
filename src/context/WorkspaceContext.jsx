
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
  const [invitations, setInvitations] = useState([]);
  const [incomingInvitations, setIncomingInvitations] = useState([]);
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

      const { data: memberNames, error: namesError } = await supabase.rpc(
        'get_workspace_member_names',
        { p_workspace_id: currentWorkspace.id }
      );

      if (namesError) throw namesError;

      const nameMap = Object.fromEntries(
        (memberNames || []).map((item) => [item.user_id, item.full_name])
      );

      const hydratedMembers = (workspaceMembers || []).map((member) => ({
        ...member,
        full_name: nameMap[member.user_id] || 'Workspace member',
      }));

      setWorkspace(currentWorkspace);
      setMembers(hydratedMembers);

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

  // Load invitations created by the workspace owner and invitations addressed to this user.
  const refreshInvitations = useCallback(async (workspaceId = workspace?.id) => {
    if (!user?.id) {
      setInvitations([]);
      setIncomingInvitations([]);
      return [];
    }

    if (workspaceId) {
      const { data, error: inviteError } = await supabase
        .from('workspace_invites')
        .select('id,workspace_id,invited_email,invited_by,status,expires_at,accepted_at,created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (inviteError) throw inviteError;
      setInvitations(data || []);
    } else {
      setInvitations([]);
    }

    if (user.email) {
      const { data, error: incomingError } = await supabase
        .from('workspace_invites')
        .select('id,workspace_id,invited_email,invited_by,status,expires_at,accepted_at,created_at')
        .eq('invited_email', user.email.trim().toLowerCase())
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (incomingError) throw incomingError;
      setIncomingInvitations(data || []);
    } else {
      setIncomingInvitations([]);
    }
  }, [user?.id, user?.email, workspace?.id]);

  const createWorkspaceInvite = useCallback(async (email) => {
    if (!workspace?.id) throw new Error('Create a Shared Workspace first.');
    setSaving(true);
    setError('');
    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) throw new Error('Enter an email address.');
      const { data, error: inviteError } = await supabase.rpc('create_workspace_invite', {
        p_workspace_id: workspace.id,
        p_invited_email: cleanEmail,
      });
      if (inviteError) throw inviteError;
      await refreshInvitations(workspace.id);
      return data;
    } catch (err) {
      setError(err.message || 'Unable to create the invitation.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [workspace?.id, refreshInvitations]);


  // Send or resend the email for an already-created invitation.
  const sendWorkspaceInviteEmail = useCallback(async (inviteId) => {
    if (!inviteId) throw new Error('Invitation ID is missing.');

    const { data, error: sendError } = await supabase.functions.invoke(
      'send-workspace-invite',
      { body: { inviteId } }
    );

    if (sendError) {
      // Supabase Functions may return a FunctionsHttpError with a JSON response body.
      let message = sendError.message || 'Unable to send the invitation email.';
      try {
        const response = sendError.context;
        if (response && typeof response.json === 'function') {
          const body = await response.json();
          if (body?.error) message = body.error;
        }
      } catch {
        // Keep the original Functions error message.
      }
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const cancelWorkspaceInvite = useCallback(async (inviteId) => {
    setSaving(true);
    setError('');
    try {
      const { error: cancelError } = await supabase.rpc('cancel_workspace_invite', { p_invite_id: inviteId });
      if (cancelError) throw cancelError;
      await refreshInvitations(workspace?.id);
    } catch (err) {
      setError(err.message || 'Unable to cancel the invitation.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [workspace?.id, refreshInvitations]);

  const acceptWorkspaceInvite = useCallback(async (inviteId) => {
    setSaving(true);
    setError('');
    try {
      const { data, error: acceptError } = await supabase.rpc('accept_workspace_invite', { p_invite_id: inviteId });
      if (acceptError) throw acceptError;
      const acceptedWorkspace = await refreshWorkspace();
      await refreshInvitations(acceptedWorkspace?.id);
      return data;
    } catch (err) {
      setError(err.message || 'Unable to accept the invitation.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshWorkspace, refreshInvitations]);

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


  // Owner can remove another member; a non-owner can leave.
  // The RPC prevents removing the workspace owner.
  const removeWorkspaceMember = useCallback(async (memberUserId) => {
    if (!workspace?.id) throw new Error('No active workspace was found.');
    if (!memberUserId) throw new Error('Member ID is missing.');

    setSaving(true);
    setError('');
    try {
      const { error: removeError } = await supabase.rpc(
        'remove_workspace_member',
        {
          p_workspace_id: workspace.id,
          p_member_user_id: memberUserId,
        }
      );
      if (removeError) throw removeError;

      await refreshWorkspace();
      await refreshInvitations(workspace.id);
    } catch (err) {
      setError(err.message || 'Unable to remove this workspace member.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [workspace?.id, refreshWorkspace, refreshInvitations]);

  // Owner exit permanently deletes the workspace and its shared data.
  const deleteWorkspace = useCallback(async () => {
    if (!workspace?.id) throw new Error('No active workspace was found.');

    setSaving(true);
    setError('');
    try {
      const { error: deleteError } = await supabase.rpc(
        'delete_shared_workspace',
        { p_workspace_id: workspace.id }
      );
      if (deleteError) throw deleteError;

      setWorkspace(null);
      setMembers([]);
      setInvitations([]);
      setIncomingInvitations([]);
      return true;
    } catch (err) {
      setError(err.message || 'Unable to delete the workspace.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [workspace?.id]);

  // Keep owner and recipient invitation lists in sync with the active account/workspace.
  useEffect(() => {
    let active = true;
    refreshInvitations(workspace?.id).catch((err) => {
      if (active) console.error('Invitation loading failed:', err.message);
    });
    return () => { active = false; };
  }, [refreshInvitations, workspace?.id]);

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
      invitations,
      incomingInvitations,
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
      refreshInvitations,
      createWorkspaceInvite,
      sendWorkspaceInviteEmail,
      cancelWorkspaceInvite,
      acceptWorkspaceInvite,
      removeWorkspaceMember,
      deleteWorkspace,
    }),
    [
      workspace,
      members,
      invitations,
      incomingInvitations,
      loading,
      saving,
      error,
      user?.id,
      refreshWorkspace,
      createWorkspace,
      refreshInvitations,
      createWorkspaceInvite,
      sendWorkspaceInviteEmail,
      cancelWorkspaceInvite,
      acceptWorkspaceInvite,
      removeWorkspaceMember,
      deleteWorkspace,
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
