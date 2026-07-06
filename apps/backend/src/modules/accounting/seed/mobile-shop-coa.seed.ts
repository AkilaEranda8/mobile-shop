export type CoaSeedRow = {
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
  subtype: string
  isControlAccount?: boolean
  isSystem?: boolean
}

export const MOBILE_SHOP_COA: CoaSeedRow[] = [
  { code: '1000', name: 'Cash on Hand', type: 'ASSET', subtype: 'CASH', isSystem: true },
  { code: '1010', name: 'Petty Cash', type: 'ASSET', subtype: 'CASH', isSystem: true },
  { code: '1100', name: 'Bank — Main', type: 'ASSET', subtype: 'BANK', isSystem: true },
  { code: '1110', name: 'Card Clearing', type: 'ASSET', subtype: 'BANK', isSystem: true },
  { code: '1120', name: 'UPI / Wallet Clearing', type: 'ASSET', subtype: 'BANK', isSystem: true },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET', subtype: 'AR', isControlAccount: true, isSystem: true },
  { code: '1300', name: 'Inventory — Mobile Devices', type: 'ASSET', subtype: 'INVENTORY', isSystem: true },
  { code: '1310', name: 'Inventory — Accessories', type: 'ASSET', subtype: 'INVENTORY', isSystem: true },
  { code: '1320', name: 'Inventory — Spare Parts', type: 'ASSET', subtype: 'INVENTORY', isSystem: true },
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'AP', isControlAccount: true, isSystem: true },
  { code: '2200', name: 'VAT Output Payable', type: 'LIABILITY', subtype: 'TAX_OUTPUT', isControlAccount: true, isSystem: true },
  { code: '2210', name: 'VAT Input Recoverable', type: 'ASSET', subtype: 'TAX_INPUT', isControlAccount: true, isSystem: true },
  { code: '2300', name: 'Salary Payable', type: 'LIABILITY', subtype: 'PAYROLL', isSystem: true },
  { code: '2310', name: 'EPF Payable', type: 'LIABILITY', subtype: 'PAYROLL', isSystem: true },
  { code: '2311', name: 'ETF Payable', type: 'LIABILITY', subtype: 'PAYROLL', isSystem: true },
  { code: '3000', name: 'Owner Equity', type: 'EQUITY', subtype: 'EQUITY', isSystem: true },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY', subtype: 'RETAINED', isSystem: true },
  { code: '4000', name: 'Sales Revenue — Mobile', type: 'INCOME', subtype: 'REVENUE', isSystem: true },
  { code: '4010', name: 'Sales Revenue — Accessories', type: 'INCOME', subtype: 'REVENUE', isSystem: true },
  { code: '4020', name: 'Service Income', type: 'INCOME', subtype: 'REVENUE', isSystem: true },
  { code: '4030', name: 'Repair Income', type: 'INCOME', subtype: 'REVENUE', isSystem: true },
  { code: '4040', name: 'Reload Commission', type: 'INCOME', subtype: 'REVENUE', isSystem: true },
  { code: '5000', name: 'COGS — Mobile', type: 'EXPENSE', subtype: 'COGS', isSystem: true },
  { code: '5010', name: 'COGS — Accessories', type: 'EXPENSE', subtype: 'COGS', isSystem: true },
  { code: '5020', name: 'Repair Parts COGS', type: 'EXPENSE', subtype: 'COGS', isSystem: true },
  { code: '5100', name: 'Operating Expenses', type: 'EXPENSE', subtype: 'OPEX', isSystem: true },
  { code: '5200', name: 'Cash Over / Short', type: 'EXPENSE', subtype: 'CASH_VARIANCE', isSystem: true },
  { code: '5999', name: 'Sales Returns & Allowances', type: 'INCOME', subtype: 'CONTRA_REVENUE', isSystem: true },
]

export const DEFAULT_ACCOUNT_KEYS = {
  cash: '1000',
  pettyCash: '1010',
  bank: '1100',
  cardClearing: '1110',
  upiClearing: '1120',
  ar: '1200',
  inventoryMobile: '1300',
  inventoryAccessory: '1310',
  inventoryParts: '1320',
  ap: '2100',
  vatOutput: '2200',
  vatInput: '2210',
  salaryPayable: '2300',
  epfPayable: '2310',
  etfPayable: '2311',
  salesMobile: '4000',
  salesAccessory: '4010',
  serviceIncome: '4020',
  repairIncome: '4030',
  reloadCommission: '4040',
  cogsMobile: '5000',
  cogsAccessory: '5010',
  repairCogs: '5020',
  opex: '5100',
  cashVariance: '5200',
  salesReturns: '5999',
  retainedEarnings: '3100',
} as const
