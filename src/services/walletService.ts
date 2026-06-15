import { auth } from '@/config/firebase';
import { storage } from './mmkv';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

function balanceKey(uid: string) {
  return `wallet_balance_${uid}`;
}

/**
 * Get locally cached wallet balance (paise) from MMKV
 */
export function getLocalBalance(uid: string): number {
  if (!uid) return 0;
  return storage.getNumber(balanceKey(uid)) ?? 0;
}

/**
 * Set locally cached wallet balance (paise) in MMKV
 */
export function setLocalBalance(uid: string, balance: number): void {
  if (!uid) return;
  storage.set(balanceKey(uid), balance);
}

/**
 * Helper: Perform authenticated API requests to backend
 */
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User is not authenticated.');
  }

  // Retrieve Firebase ID token for authorization header
  const token = await currentUser.getIdToken(true);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch fresh wallet balance (paise) from Firestore via backend
 * Updates the local MMKV cache with the fetched value.
 */
export async function fetchBalanceFromDb(uid: string): Promise<number> {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('@/config/firebase');
  
  try {
    const walletDoc = await getDoc(doc(db, 'wallets', uid));
    if (walletDoc.exists()) {
      const balance = walletDoc.data().balance ?? 0;
      setLocalBalance(uid, balance);
      return balance;
    }
    setLocalBalance(uid, 0);
    return 0;
  } catch (error) {
    console.warn('[Wallet Service] Failed to fetch balance directly from Firestore, falling back to local:', error);
    return getLocalBalance(uid);
  }
}

/**
 * Create Razorpay Order
 */
export async function createDepositOrder(amount: number): Promise<{
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}> {
  return apiCall('/api/v1/wallet/order', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

/**
 * Verify Razorpay Payment Signature
 */
export async function verifyDeposit(paymentDetails: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{
  status: string;
  message: string;
  credited: number;
}> {
  return apiCall('/api/v1/wallet/verify', {
    method: 'POST',
    body: JSON.stringify(paymentDetails),
  });
}

/**
 * Transfer funds to another user
 */
export async function transferFunds(
  receiverUid: string,
  amount: number // in paise
): Promise<{
  status: string;
  message: string;
  amount: number;
  remainingBalance: number;
  recipientName: string;
  reference: string;
}> {
  return apiCall('/api/v1/wallet/transfer', {
    method: 'POST',
    body: JSON.stringify({ receiverUid, amount }),
  });
}

/**
 * Request funds from another user
 */
export async function requestFunds(
  payerUid: string,
  amount: number, // in paise
  note: string
): Promise<{
  status: string;
  message: string;
  request: any;
}> {
  return apiCall('/api/v1/wallet/request', {
    method: 'POST',
    body: JSON.stringify({ payerUid, amount, note }),
  });
}

/**
 * Respond to a payment request (PAY or DECLINE)
 */
export async function respondToRequest(
  requestId: string,
  action: 'PAY' | 'DECLINE'
): Promise<{
  status: string;
  message: string;
  result: any;
}> {
  return apiCall('/api/v1/wallet/request/respond', {
    method: 'POST',
    body: JSON.stringify({ requestId, action }),
  });
}
