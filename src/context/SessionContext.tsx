'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { SessionUser, Role } from '@/lib/auth';

interface SessionContextType {
  user: SessionUser | null;
  hasRole: (roles: Role[]) => boolean;
  isAdmin: boolean;
  isCashier: boolean;
  isManager: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: SessionUser | null;
}) {
  const hasRole = (roles: Role[]) => {
    if (!initialUser) return false;
    const userRole = initialUser.role === 'USER' ? 'CASHIER' : initialUser.role;
    return roles.includes(userRole as Role) || roles.includes(initialUser.role);
  };

  const isAdmin = initialUser?.role === 'ADMIN';
  const isCashier = initialUser?.role === 'CASHIER' || initialUser?.role === 'USER';
  const isManager = initialUser?.role === 'MANAGER';

  return (
    <SessionContext.Provider
      value={{
        user: initialUser,
        hasRole,
        isAdmin,
        isCashier,
        isManager,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
