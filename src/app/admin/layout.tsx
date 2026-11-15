import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar/AdminSidebar';
import AdminHeader from '@/components/AdminHeader/AdminHeader';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Admin · PRISM Management System',
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // proxy.ts already gates /admin, but re-checking here keeps the guard intact
  // if the matcher changes, and gives the header the signed-in user.
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, marginLeft: '230px', display: 'flex', flexDirection: 'column' }}>
        <AdminHeader user={user} />
        <main style={{ flex: 1, padding: '24px 32px', backgroundColor: 'var(--gray-100)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
