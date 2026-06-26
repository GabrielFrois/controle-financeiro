import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Transaction, PaymentMethod } from '../types';

export function useInvoice(
  transactions: Transaction[],
  paymentMethods: PaymentMethod[]
) {
  const creditCards = useMemo(
    () => paymentMethods.filter((m) => m.closing_day),
    [paymentMethods]
  );

  const [selectedCardId, setSelectedCardId] = useState('');
  const [invoiceMonth, setInvoiceMonth]     = useState('');

  // Auto-selects the first credit card on load
  useEffect(() => {
    if (creditCards.length > 0 && !selectedCardId) {
      setSelectedCardId(String(creditCards[0].id));
    }
  }, [creditCards, selectedCardId]);

  const getSmartInvoiceDate = useCallback(
    (cardId: number): string => {
      const card = paymentMethods.find((m) => m.id === cardId);
      if (!card || !card.closing_day) return new Date().toISOString().slice(0, 7);

      const today      = new Date();
      const currentDay = today.getDate();
      const nextInvoice = new Date(today);
      nextInvoice.setMonth(nextInvoice.getMonth() + 1);
      const invoiceStr = nextInvoice.toISOString().slice(0, 7);

      // If already past closing day, check if current invoice is paid
      if (currentDay >= card.closing_day) {
        const debt = transactions
          .filter(
            (t) =>
              t.payment_method_id === cardId &&
              t.date.startsWith(invoiceStr) &&
              t.type === 'EXPENSE'
          )
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const [year, month] = invoiceStr.split('-');
        const monthName = new Date(Number(year), Number(month) - 1, 15)
          .toLocaleDateString('pt-BR', { month: 'long' });
        const targetString = `${monthName}/${year}`.toLowerCase();

        const paid = transactions
          .filter(
            (t) =>
              t.type === 'EXPENSE' &&
              t.payment_method_id !== cardId &&
              t.description.toLowerCase().includes('pagamento fatura') &&
              t.description.toLowerCase().includes((card.name as any)?.toLowerCase?.() ?? '') &&
              t.description.toLowerCase().includes(targetString)
          )
          .reduce((acc, t) => acc + Number(t.amount), 0);

        if (debt - paid <= 1) {
          const next = new Date(nextInvoice);
          next.setMonth(next.getMonth() + 1);
          return next.toISOString().slice(0, 7);
        }
      }

      return invoiceStr;
    },
    [paymentMethods, transactions]
  );

  // Set initial smart invoice date once data is available
  useEffect(() => {
    if (selectedCardId && paymentMethods.length > 0 && transactions.length > 0 && !invoiceMonth) {
      setInvoiceMonth(getSmartInvoiceDate(Number(selectedCardId)));
    }
  }, [selectedCardId, paymentMethods, transactions, getSmartInvoiceDate, invoiceMonth]);

  const jumpToCurrentInvoice = () => {
    if (selectedCardId) setInvoiceMonth(getSmartInvoiceDate(Number(selectedCardId)));
  };

  const invoiceData = useMemo(() => {
    const empty = { items: [], payments: [], totalInvoice: 0, totalPaid: 0, dueDate: '', cardLimit: 0, totalUsedLimit: 0 };
    if (!selectedCardId || !invoiceMonth) return empty;

    const card      = creditCards.find((c) => c.id === Number(selectedCardId));
    const cardName  = (card as any)?.name ?? '';
    const cardLimit = Number(card?.card_limit) || 0;

    const items = transactions.filter(
      (t) =>
        t.payment_method_id === Number(selectedCardId) &&
        t.date.startsWith(invoiceMonth) &&
        t.type === 'EXPENSE'
    );

    const [year, month] = invoiceMonth.split('-');
    const monthName     = new Date(Number(year), Number(month) - 1, 15).toLocaleDateString('pt-BR', { month: 'long' });
    const targetString  = `${monthName}/${year}`.toLowerCase();

    const payments = transactions.filter(
      (t) =>
        t.type === 'EXPENSE' &&
        t.payment_method_id !== Number(selectedCardId) &&
        t.description.toLowerCase().includes('pagamento fatura') &&
        t.description.toLowerCase().includes(cardName.toLowerCase()) &&
        t.description.toLowerCase().includes(targetString)
    );

    const totalInvoice = items.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalPaid    = payments.reduce((acc, t) => acc + Number(t.amount), 0);
    const dueDay       = card?.due_day ?? 10;
    const dueDate      = `${invoiceMonth}-${String(dueDay).padStart(2, '0')}`;

    const allTimeSpend = transactions
      .filter((t) => t.payment_method_id === Number(selectedCardId) && t.type === 'EXPENSE')
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const allTimePayments = transactions
      .filter(
        (t) =>
          t.type === 'EXPENSE' &&
          t.payment_method_id !== Number(selectedCardId) &&
          t.description.toLowerCase().includes('pagamento fatura') &&
          t.description.toLowerCase().includes(cardName.toLowerCase())
      )
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const totalUsedLimit = Math.max(0, allTimeSpend - allTimePayments);

    return { items, payments, totalInvoice, totalPaid, dueDate, cardLimit, totalUsedLimit };
  }, [transactions, selectedCardId, invoiceMonth, creditCards]);

  return {
    creditCards,
    selectedCardId, setSelectedCardId,
    invoiceMonth,   setInvoiceMonth,
    invoiceData,
    jumpToCurrentInvoice,
  };
}