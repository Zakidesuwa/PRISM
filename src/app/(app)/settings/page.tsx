import ui from '@/styles/ui.module.css';
import { requireBranchUser } from '@/lib/authGuard';
import { AuditService } from '@/services/auditService';
import { BranchService } from '@/services/branchService';
import { SettingsService } from '@/services/settingsService';
import { formatManilaDateTime } from '@/utils/formatters';
import StoreProfileForm from './StoreProfileForm';

export const metadata = { title: 'Settings · PRISM' };

export default async function SettingsPage() {
  const user = await requireBranchUser(['MANAGER']);
  const [branch, settings, activity] = await Promise.all([
    BranchService.get(user.branchId),
    SettingsService.get(),
    AuditService.getRecentLogs(user.branchId, 40),
  ]);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>Settings</h1>
          <p className={ui.subtitle}>Your cooperative&apos;s profile and recent activity.</p>
        </div>
      </div>

      <div className={ui.grid2}>
        {branch && <StoreProfileForm branch={branch} />}

        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <h2 className={ui.cardTitle}>District rules</h2>
            <span className={ui.muted}>Set by the administrator</span>
          </div>
          <table className={ui.table}>
            <tbody>
              <tr>
                <td>Sales tax added at the till</td>
                <td className={ui.num}>{settings.taxes.taxRate}%</td>
              </tr>
              <tr>
                <td>Who can void a sale</td>
                <td className={ui.num}>{settings.preferences.managerOverrideVoids ? 'Managers only' : 'Cashiers and managers'}</td>
              </tr>
              <tr>
                <td>Low-stock alerts</td>
                <td className={ui.num}>{settings.preferences.lowStockAlerts ? 'On' : 'Off'}</td>
              </tr>
              <tr>
                <td>Print receipt automatically</td>
                <td className={ui.num}>{settings.preferences.autoPrintReceipts ? 'On' : 'Off'}</td>
              </tr>
              <tr>
                <td>Receipt footer</td>
                <td className={ui.num}>{settings.receipts.footerText || '—'}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>Activity log</h2>
          <span className={ui.muted}>Latest {activity.length} actions in your cooperative</span>
        </div>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatManilaDateTime(entry.timestamp)}</td>
                  <td>{entry.userName}</td>
                  <td className={ui.strong}>{entry.action.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className={ui.muted}>{entry.details ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
