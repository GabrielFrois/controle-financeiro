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

  useEffect(() => {
    if (creditCards.length > 0 && !selectedCardId) {
      setSelectedCardId(String(creditCards[0].id));
    }
  }, [creditCards, selectedCardId]);

  // Saldo comprometido do cartão: soma de TODAS as parcelas (passadas e
  // futuras) já lançadas nesse cartão, menos os pagamentos de fatura já
  // registrados para ele (via is_invoice_payment + paid_card_id). Isso é o
  // que reflete o limite realmente usado, igual num cartão de verdade —
  // uma compra parcelada bloqueia o valor total no ato da compra, não só a
  // parcela do mês corrente.
  const getCommittedBalance = useCallback(
    (cardId: number): number => {
      const spent = transactions
        .filter((t) => t.payment_method_id === cardId && t.type === 'EXPENSE' && !t.is_invoice_payment)
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const paid = transactions
        .filter((t) => t.paid_card_id === cardId && t.type === 'EXPENSE' && t.is_invoice_payment)
        .reduce((acc, t) => acc + Number(t.amount), 0);

      return Math.max(0, spent - paid);
    },
    [transactions]
  );

  const getSmartInvoiceDate = useCallback(
    (cardId: number): string => {
      const card = paymentMethods.find((m) => m.id === cardId);
      if (!card || !card.closing_day) return new Date().toISOString().slice(0, 7);

      const today      = new Date();
      const currentDay = today.getDate();
      const nextInvoice = new Date(today);
      nextInvoice.setMonth(nextInvoice.getMonth() + 1);
      const invoiceStr = nextInvoice.toISOString().slice(0, 7);

      if (currentDay >= card.closing_day) {
        const debt = transactions
          .filter(
            (t) =>
              t.payment_method_id === cardId &&
              t.date.startsWith(invoiceStr) &&
              t.type === 'EXPENSE' &&
              !t.is_invoice_payment
          )
          .reduce((acc, t) => acc + Number(t.amount), 0);

        const paid = transactions
          .filter(
            (t) =>
              t.type === 'EXPENSE' &&
              t.is_invoice_payment &&
              t.paid_card_id === cardId &&
              t.invoice_reference_month === invoiceStr
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

  useEffect(() => {
    if (selectedCardId && paymentMethods.length > 0 && transactions.length > 0 && !invoiceMonth) {
      setInvoiceMonth(getSmartInvoiceDate(Number(selectedCardId)));
    }
  }, [selectedCardId, paymentMethods, transactions, getSmartInvoiceDate, invoiceMonth]);

  const jumpToCurrentInvoice = () => {
    if (selectedCardId) setInvoiceMonth(getSmartInvoiceDate(Number(selectedCardId)));
  };

  const invoiceData = useMemo(() => {
    const empty = { items: [], payments: [], totalInvoice: 0, totalPaid: 0, dueDate: '', cardLimit: 0, totalUsedLimit: 0, availableLimit: null as number | null };
    if (!selectedCardId || !invoiceMonth) return empty;

    const card      = creditCards.find((c) => c.id === Number(selectedCardId));
    const cardLimit = Number(card?.card_limit) || 0;
    const cardId    = Number(selectedCardId);

    const items = transactions.filter(
      (t) =>
        t.payment_method_id === cardId &&
        t.date.startsWith(invoiceMonth) &&
        t.type === 'EXPENSE' &&
        !t.is_invoice_payment
    );

    // Pagamentos vinculados explicitamente a esta fatura (cartão + mês de
    // referência), sem depender de casar texto na descrição.
    const payments = transactions.filter(
      (t) =>
        t.type === 'EXPENSE' &&
        t.is_invoice_payment &&
        t.paid_card_id === cardId &&
        t.invoice_reference_month === invoiceMonth
    );

    const totalInvoice = items.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalPaid    = payments.reduce((acc, t) => acc + Number(t.amount), 0);
    const dueDay       = card?.due_day ?? 10;
    const dueDate      = `${invoiceMonth}-${String(dueDay).padStart(2, '0')}`;

    const totalUsedLimit = getCommittedBalance(cardId);
    const availableLimit = cardLimit > 0 ? cardLimit - totalUsedLimit : null;

    return { items, payments, totalInvoice, totalPaid, dueDate, cardLimit, totalUsedLimit, availableLimit };
  }, [transactions, selectedCardId, invoiceMonth, creditCards, getCommittedBalance]);

  return {
    creditCards,
    selectedCardId, setSelectedCardId,
    invoiceMonth,   setInvoiceMonth,
    invoiceData,
    jumpToCurrentInvoice,
  };
}