// src/services/settingsService.ts
import prisma from '@/lib/prisma';
import { mergeSettings, type SystemSettings } from '@/lib/settings';
import { AuditService } from './auditService';

export class SettingsService {
  static async get(): Promise<SystemSettings> {
    const row = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    return mergeSettings(row?.data);
  }

  static async save(input: unknown, userId: string | null): Promise<SystemSettings> {
    const settings = mergeSettings(input);

    const taxRate = Number(settings.taxes.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new Error('Tax rate must be between 0 and 100.');
    }
    settings.taxes.taxRate = Math.round(taxRate * 100) / 100;

    if (!settings.general.canteenName.trim()) throw new Error('System name is required.');

    const data = JSON.parse(JSON.stringify(settings));
    await prisma.systemSetting.upsert({
      where: { id: 1 },
      create: { id: 1, data },
      update: { data },
    });
    await AuditService.log({ userId, action: 'SETTINGS_UPDATE', entityType: 'SystemSetting', entityId: 1 });

    return settings;
  }
}
