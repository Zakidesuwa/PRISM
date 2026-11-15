import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import Header from '@/components/Header/Header';
import { getSession } from '@/lib/session';
import { SessionProvider } from '@/context/SessionContext';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  return (
    <SessionProvider initialUser={user}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar userRole={user.role} />
        <div style={{ flex: 1, marginLeft: '230px', display: 'flex', flexDirection: 'column' }}>
          <Header user={user} />
          <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
