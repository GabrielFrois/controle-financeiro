export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
  color: string;
  active?: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
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
}

export interface User { id: number; name: string; color: string; active: boolean; }
export interface Category { id: number; name: string; type: string; color: string; active: boolean; }
export interface PaymentMethod { id: number; name: string; closing_day: number | null; due_day: number | null; card_limit: number | null; active: boolean; }