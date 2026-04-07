export interface MonthData {
  id: string;
  month: string;
  year: number;
  expenses: {
    [key: string]: number;
  };
  income: {
    [key: string]: number;
  };
}

export interface Loan {
  id: string;
  description: string;
  totalValue: number;
  installments: number;
  paidInstallments: number;
  installmentValue: number;
  interestMonthly: number;
  month: string;
  endMonth?: string;
}

export interface VehicleExpense {
  id: string;
  type: string;
  category: string;
  description: string;
  value: number;
  month: string;
}

export interface Saving {
  id: string;
  type: string;
  value: number;
  description: string;
  month: string;
}

export interface CategorizedExpense {
  id: string;
  category: string;
  value: number;
  month: string;
  description: string;
}

export interface FinanceData {
  months: MonthData[];
  loans: Loan[];
  trips: any[];
  vehicleExpenses: VehicleExpense[];
  savings: Saving[];
  categorizedExpenses: CategorizedExpense[];
}
