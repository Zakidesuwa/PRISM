import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar/Sidebar';
import Header, { type HeaderAlert } from '@/components/Header/Header';
import { getSession } from '@/lib/session';
import { SessionProvider } from '@/context/SessionContext';
import { InventoryService } from '@/services/inventoryService';
import { SettingsService } from '@/services/settingsService';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }
  // The store area is for cooperative staff; the administrator has no store.
  if (user.branchId === null) {
    redirect('/admin');
  }

  // Low-stock alerts for the bell, for the roles that act on them.
  let alerts: HeaderAlert[] = [];
  if (user.role !== 'CASHIER') {
    const settings = await SettingsService.get();
    if (settings.preferences.lowStockAlerts) {
      const items = await InventoryService.list(user.branchId);
      alerts = items
        .filter((item) => item.status !== 'Optimal')
        // Most urgent first: out of stock, then the lowest remaining.
        .sort((a, b) => (a.status === b.status ? a.stock - b.stock : a.status === 'Empty' ? -1 : 1))
        .map((item) => ({
          id: item.id,
          title: item.status === 'Empty' ? `Out of stock: ${item.name}` : `Low stock: ${item.name}`,
          desc: `${item.stock} ${item.unit} left (reorder at ${item.reorderLevel})`,
          severity: item.status === 'Empty' ? ('empty' as const) : ('low' as const),
        }));
    }
  }

  return (
    <SessionProvider initialUser={user}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar userRole={user.role} badges={{ '/inventory': alerts.length }} />
        <div style={{ flex: 1, marginLeft: '230px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Header user={user} alerts={alerts} />
          <main id="main-content" tabIndex={-1} style={{ flex: 1, padding: '24px', outline: 'none' }}>
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
