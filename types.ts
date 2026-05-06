/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'SUPER_ADMIN' | 'DG' | 'CZ' | 'CT' | 'CC' | 'EMPLOYEE' | 'INTERN';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  tempPass?: string;
  managerId?: string; // Hierarchical link
  photoURL?: string;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  alertLevel: number;
  supplierName: string;
  imageUrl?: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  status: 'available' | 'low' | 'out_of_stock';
}

export interface MovementItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface StockMovement {
  id: string;
  items: MovementItem[];
  totalAmount: number;
  totalItems: number;
  type: 'IN' | 'OUT';
  actorId: string;
  actorName: string;
  userId: string;
  userName: string;
  createdAt: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  photoURL?: string;
  createdAt: number;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  relatedArticles: string;
  photoURL?: string;
  createdAt: number;
}
