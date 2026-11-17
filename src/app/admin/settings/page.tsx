import { SettingsService } from '@/services/settingsService';
import SettingsClient from './SettingsClient';

export default async function AdminSettingsPage() {
  const settings = await SettingsService.get();
  return <SettingsClient initial={settings} />;
}
