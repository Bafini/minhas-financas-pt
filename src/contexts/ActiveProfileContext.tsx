import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PartnerInfo {
  id: string;
  displayName: string;
  email: string;
  permissionLevel: string;
}

interface ActiveProfileContextType {
  /** The user_id to use for all data queries */
  activeUserId: string;
  /** Whether viewing partner's profile */
  isViewingPartner: boolean;
  /** Partner info if partnership exists */
  partner: PartnerInfo | null;
  /** Whether current user has write access to active profile */
  canWrite: boolean;
  /** Switch to own or partner's profile */
  switchProfile: (toPartner: boolean) => void;
  /** Own user display name */
  ownDisplayName: string;
}

const ActiveProfileContext = createContext<ActiveProfileContextType | undefined>(undefined);

export const useActiveProfile = () => {
  const context = useContext(ActiveProfileContext);
  if (!context) throw new Error('useActiveProfile must be used within ActiveProfileProvider');
  return context;
};

export const ActiveProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [isViewingPartner, setIsViewingPartner] = useState(false);
  const [ownDisplayName, setOwnDisplayName] = useState('');

  useEffect(() => {
    if (!user) {
      setPartner(null);
      setIsViewingPartner(false);
      return;
    }

    const loadPartnership = async () => {
      // Load own display name
      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();
      setOwnDisplayName(ownProfile?.display_name || user.email || '');

      // Load accepted partnership
      const { data: partnerships } = await supabase
        .from('partnerships')
        .select('*')
        .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`)
        .eq('status', 'accepted');

      const p = (partnerships || [])[0] as any;
      if (!p) {
        setPartner(null);
        setIsViewingPartner(false);
        return;
      }

      const partnerId = p.requester_id === user.id ? p.target_id : p.requester_id;
      // Permission the current user has on partner's data
      const permissionOnPartner = p.requester_id === user.id ? 'full' : p.permission_level;

      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', partnerId)
        .single();

      setPartner({
        id: partnerId,
        displayName: partnerProfile?.display_name || p.target_email || '',
        email: p.requester_id === user.id ? p.target_email : user.email || '',
        permissionLevel: permissionOnPartner,
      });
    };

    loadPartnership();
  }, [user]);

  const activeUserId = isViewingPartner && partner ? partner.id : (user?.id || '');
  
  const canWrite = isViewingPartner && partner
    ? partner.permissionLevel === 'full'
    : true;

  const switchProfile = (toPartner: boolean) => {
    if (toPartner && !partner) return;
    setIsViewingPartner(toPartner);
  };

  return (
    <ActiveProfileContext.Provider value={{
      activeUserId,
      isViewingPartner,
      partner,
      canWrite,
      switchProfile,
      ownDisplayName,
    }}>
      {children}
    </ActiveProfileContext.Provider>
  );
};
