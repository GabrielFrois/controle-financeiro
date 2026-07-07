export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: 'admin' | 'member';
  color: string;
  active?: boolean;
}

export interface User {
  id: number;
  name: string;
  username: string;
  color: string;
  role: 'admin' | 'member';
  active: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  category_id: number;
  category_name: string;
  category_color: string;
  user_id: number;
  user_name: string;
  user_color: string;
  payment_method_id: number;
  payment_method_name: string;
  installment_group_id: string | null;
  asset_ticker: string | null;
  quantity: number | null;
  investment_type: string;
  yield_rate: number | null;
  created_at: string;
  // Pagamento de fatura de cartão: quando is_invoice_payment é true, esta
  // transação quita a fatura do cartão paid_card_id referente ao mês
  // invoice_reference_month (YYYY-MM).
  is_invoice_payment: boolean;
  paid_card_id: number | null;
  invoice_reference_month: string | null;
}

export interface User { id: number; name: string; color: string; active: boolean; }
export interface Category { id: number; name: string; type: string; color: string; active: boolean; }
export interface PaymentMethod { id: number; name: string; closing_day: number | null; due_day: number | null; card_limit: number | null; active: boolean; }