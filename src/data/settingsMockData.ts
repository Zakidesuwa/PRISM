// Default system settings for the admin prototype.
// These live in component state only — there is no backend to persist them yet.
// Phase 2 should load and save these from the database.

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

export const CURRENCY_OPTIONS = [
  'PHP (₱) - Philippine Peso',
  'USD ($) - US Dollar',
];

export const PRINTER_OPTIONS = [
  'Epson TM-T88VI (Thermal)',
  'Star TSP143III (Thermal)',
  'No printer configured',
];

export const SCANNER_OPTIONS = [
  'Symbol LS2208 (USB)',
  'Honeywell Voyager 1200g',
  'No scanner configured',
];

export const PAPER_SIZES = ['58 mm', '80 mm'];

export const defaultSettings: SystemSettings = {
  general: {
    canteenName: 'Main Campus Cafeteria',
    contactEmail: 'admin@campuscafe.edu',
    phoneNumber: '+63 917 555 0142',
    // The rest of PRISM prices in pesos, so that is the sensible default.
    currency: CURRENCY_OPTIONS[0],
  },
  preferences: {
    lowStockAlerts: true,
    managerOverrideVoids: true,
    autoPrintReceipts: false,
  },
  taxes: {
    // Matches the 5% applied on the POS screen.
    taxRate: 5,
    serviceCharge: 0,
    pricesIncludeTax: true,
  },
  hardware: {
    receiptPrinter: PRINTER_OPTIONS[0],
    barcodeScanner: SCANNER_OPTIONS[0],
    cashDrawerLinked: true,
  },
  receipts: {
    headerText: 'PRISM Canteen — City Government of Olongapo',
    footerText: 'This serves as your official receipt. Thank you!',
    paperSize: PAPER_SIZES[1],
    showLogo: true,
  },
};
