'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import type { SessionUser, Role } from '@/lib/roles';

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
  const hasRole = (roles: Role[]) => (initialUser ? roles.includes(initialUser.role) : false);

  return (
    <SessionContext.Provider
      value={{
        user: initialUser,
        hasRole,
        isAdmin: initialUser?.role === 'ADMIN',
        isCashier: initialUser?.role === 'CASHIER',
        isManager: initialUser?.role === 'MANAGER',
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
