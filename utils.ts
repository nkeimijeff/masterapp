/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return `${formatNumber(amount)} FCFA`;
}

export function formatNumber(amount: number) {
  if (amount === undefined || amount === null) return '0';
  return Math.floor(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}
