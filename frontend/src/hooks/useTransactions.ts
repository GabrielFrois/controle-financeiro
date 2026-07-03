import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useFamily } from '../context/FamilyContext';
import type { Transaction, User, Category, PaymentMethod } from '../types';

export type { Transaction, User, Category, PaymentMethod };

export function useTransactions() {
  const { activeUserIds } = useFamily();

  const [loading, setLoading]               = useState(true);
  const [transactions, setTransactions]     = useState<Transaction[]>([]);
  const [users, setUsers]                   = useState<User[]>([]);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeUserIds.length > 0
        ? { params: { user_ids: activeUserIds.join(',') } }
        : {};

      const [transRes, userRes, catRes, payRes] = await Promise.all([
        api.get('/transactions', params),
        api.get('/users'),
        api.get('/categories'),
        api.get('/payment-methods'),
      ]);
      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setPaymentMethods(Array.isArray(payRes.data) ? payRes.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeUserIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { loading, transactions, users, categories, paymentMethods, fetchData };
}