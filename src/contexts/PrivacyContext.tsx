import React, { createContext, useContext, useState, useEffect } from 'react';

interface PrivacyContextType {
  hidden: boolean;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({ hidden: false, toggle: () => {} });

export const usePrivacy = () => useContext(PrivacyContext);

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hidden, setHidden] = useState(() => localStorage.getItem('privacy-mode') === 'true');

  useEffect(() => {
    document.body.classList.toggle('privacy-mode', hidden);
    localStorage.setItem('privacy-mode', String(hidden));
  }, [hidden]);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle: () => setHidden(h => !h) }}>
      {children}
    </PrivacyContext.Provider>
  );
};
