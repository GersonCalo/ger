import type { Transaction } from '@/types';

export type TransactionFormValues = {
  type: 'income' | 'expense';
  amount: string;
  categoryId: string;
  note: string;
  occurredAt: string;
};

export function createInitialValues(): TransactionFormValues {
  return {
    type: 'expense',
    amount: '',
    categoryId: '',
    note: '',
    occurredAt: new Date().toISOString().slice(0, 16),
  };
}

export function fromTransaction(tx: Transaction): TransactionFormValues {
  return {
    type: tx.type,
    amount: String(tx.amount),
    categoryId: tx.categoryId || '',
    note: tx.note || '',
    occurredAt: new Date(tx.occurredAt).toISOString().slice(0, 16),
  };
}

export function validateAmount(amount: string): boolean {
  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed > 0;
}

export function validateOccurredAt(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function isDirty(
  current: TransactionFormValues,
  initial: TransactionFormValues
): boolean {
  return (
    current.type !== initial.type ||
    current.amount !== initial.amount ||
    current.categoryId !== initial.categoryId ||
    current.note !== initial.note ||
    current.occurredAt !== initial.occurredAt
  );
}
