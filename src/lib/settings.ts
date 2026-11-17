// src/lib/settings.ts
// District-wide system settings (stored as one JSON row; see SystemSetting).

export interface SystemSettings {
  general: {
    canteenName: string;
    contactEmail: string;
    phoneNumber: string;
    currency: string;
  };
  preferences: {
    lowStockAlerts: boolean;
    managerOverrideVoids: boolean;
    autoPrintReceipts: boolean;
  };
  taxes: {
    taxRate: number;
    serviceCharge: number;
    pricesIncludeTax: boolean;
  };
  hardware: {
    receiptPrinter: string;
    barcodeScanner: string;
    cashDrawerLinked: boolean;
  };
  receipts: {
    headerText: string;
    footerText: string;
    paperSize: string;
    showLogo: boolean;
  };
}

export const CURRENCY_OPTIONS = ['PHP (₱) - Philippine Peso'];

export const PRINTER_OPTIONS = [
  'Browser print dialog',
  'Epson TM-T88VI (Thermal)',
  'Star TSP143III (Thermal)',
];

export const SCANNER_OPTIONS = ['USB / keyboard scanner', 'No scanner'];

export const PAPER_SIZES = ['58 mm', '80 mm'];

export const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    canteenName: 'PRISM School Cooperatives',
    contactEmail: '',
    phoneNumber: '',
    currency: CURRENCY_OPTIONS[0],
  },
  preferences: {
    lowStockAlerts: true,
    managerOverrideVoids: true,
    autoPrintReceipts: false,
  },
  taxes: {
    taxRate: 5,
    serviceCharge: 0,
    pricesIncludeTax: false,
  },
  hardware: {
    receiptPrinter: PRINTER_OPTIONS[0],
    barcodeScanner: SCANNER_OPTIONS[0],
    cashDrawerLinked: false,
  },
  receipts: {
    headerText: 'City Government of Olongapo — School Cooperative',
    footerText: 'Thank you for supporting your cooperative!',
    paperSize: PAPER_SIZES[1],
    showLogo: true,
  },
};

/** Fills in anything missing from a stored settings object. */
export function mergeSettings(stored: unknown): SystemSettings {
  const source = (stored && typeof stored === 'object' ? stored : {}) as Partial<SystemSettings>;
  return {
    general: { ...DEFAULT_SETTINGS.general, ...source.general },
    preferences: { ...DEFAULT_SETTINGS.preferences, ...source.preferences },
    taxes: { ...DEFAULT_SETTINGS.taxes, ...source.taxes },
    hardware: { ...DEFAULT_SETTINGS.hardware, ...source.hardware },
    receipts: { ...DEFAULT_SETTINGS.receipts, ...source.receipts },
  };
}
