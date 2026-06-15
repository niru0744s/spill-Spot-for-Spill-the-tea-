import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/config/firebase';
import { Platform } from 'react-native';
import {
  getLocalBalance,
  setLocalBalance,
  fetchBalanceFromDb,
  createDepositOrder,
  verifyDeposit,
  transferFunds,
  requestFunds,
  respondToRequest
} from '@/services/walletService';
import { storage } from '@/services/mmkv';
import { triggerSuccessNotification, triggerHeavyImpact } from '@/services/hapticService';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

// @ts-ignore: react-native-razorpay lacks default TypeScript declarations
import RazorpayCheckout from 'react-native-razorpay';

export interface WalletTransaction {
  id: string;
  userId: string;
  counterpartyId?: string;
  counterpartyName?: string;
  amount: number; // paise
  type: 'ADD_FUNDS' | 'SEND_FUNDS' | 'RECEIVE_FUNDS' | 'WITHDRAW';
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  reference: string;
  createdAt: any;
}

export function useWallet() {
  const uid = auth.currentUser?.uid ?? '';
  const [balance, setBalance] = useState<number>(() => getLocalBalance(uid));
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  // Format balance (e.g. 5000 paise -> ₹50.00)
  const formattedBalance = `₹${(balance / 100).toFixed(2)}`;

  // 1. Sync balance changes from MMKV storage in real-time
  useEffect(() => {
    if (!uid) return;

    // Load initial balance
    setBalance(getLocalBalance(uid));

    const listener = storage.addOnValueChangedListener((key) => {
      if (key === `wallet_balance_${uid}`) {
        setBalance(getLocalBalance(uid));
      }
    });

    // Fetch fresh balance from DB in background
    fetchBalanceFromDb(uid).catch((err) => console.warn('[useWallet] Background balance fetch failed:', err));

    return () => listener.remove();
  }, [uid]);

  // 2. Listen to transaction history in real-time from Firestore
  useEffect(() => {
    if (!uid) return;

    // Dynamic import to keep init lightweight
    let unsub: () => void = () => {};
    import('@/config/firebase').then(({ db }) => {
      const txRef = collection(db, 'walletTransactions');
      const q = query(
        txRef,
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      unsub = onSnapshot(q, (snapshot) => {
        const list: WalletTransaction[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            userId: data.userId,
            counterpartyId: data.counterpartyId,
            counterpartyName: data.counterpartyName,
            amount: data.amount ?? 0,
            type: data.type,
            status: data.status,
            reference: data.reference,
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          });
        });
        setTransactions(list);
      }, (err) => {
        console.warn('[useWallet] Failed to listen to transaction history:', err);
      });
    });

    return () => unsub();
  }, [uid]);

  // 3. Deposit money (Add Funds via Razorpay)
  const depositFunds = useCallback(async (amount: number): Promise<boolean> => {
    if (amount <= 0) return false;
    setIsLoading(true);

    try {
      // Step A: Create order on backend
      const order = await createDepositOrder(amount);

      // Step B: Launch Razorpay Checkout sheet
      const checkoutOptions = {
        description: 'Deposit funds to Spill Wallet',
        image: 'https://i.imgur.com/3g7A6Zl.png', // custom placeholder
        currency: order.currency,
        key: order.key_id,
        amount: order.amount,
        name: 'Spill Pay',
        order_id: order.order_id,
        prefill: {
          email: auth.currentUser?.email || '',
          name: auth.currentUser?.displayName || '',
        },
        theme: { color: '#7adc7d' }, // Matcha Green
      };

      if (Platform.OS === 'web') {
        alert('Web Razorpay checkout simulation: Depositing money.');
        // Web mock verify payload
        const simulatedVerification = await verifyDeposit({
          razorpay_order_id: order.order_id,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: 'simulated_sig',
        });
        setIsLoading(false);
        if (simulatedVerification.status === 'success') {
          triggerSuccessNotification();
          await fetchBalanceFromDb(uid);
          return true;
        }
        return false;
      }

      // Native Razorpay Checkout
      return new Promise<boolean>((resolve) => {
        RazorpayCheckout.open(checkoutOptions)
          .then(async (data: any) => {
            try {
              // Step C: Send checkout result to backend for signature verification
              const verifyRes = await verifyDeposit({
                razorpay_order_id: data.razorpay_order_id,
                razorpay_payment_id: data.razorpay_payment_id,
                razorpay_signature: data.razorpay_signature,
              });

              if (verifyRes.status === 'success') {
                triggerSuccessNotification();
                await fetchBalanceFromDb(uid);
                resolve(true);
              } else {
                triggerHeavyImpact();
                resolve(false);
              }
            } catch (err) {
              console.error('[useWallet] Verification API failed:', err);
              triggerHeavyImpact();
              resolve(false);
            } finally {
              setIsLoading(false);
            }
          })
          .catch((err: any) => {
            console.warn('[useWallet] Razorpay Checkout dismissed or failed:', err);
            triggerHeavyImpact();
            setIsLoading(false);
            resolve(false);
          });
      });
    } catch (err) {
      console.error('[useWallet] Deposit Order creation failed:', err);
      triggerHeavyImpact();
      setIsLoading(false);
      return false;
    }
  }, [uid]);

  // 4. Send Funds (Transfer)
  const sendMoney = useCallback(async (receiverUid: string, amountInRupees: number): Promise<{ success: boolean; message: string; reference?: string }> => {
    setIsLoading(true);
    const amountInPaise = Math.round(amountInRupees * 100);

    try {
      const res = await transferFunds(receiverUid, amountInPaise);
      if (res.status === 'success') {
        triggerSuccessNotification();
        // Update local balance state immediately
        setLocalBalance(uid, res.remainingBalance);
        setBalance(res.remainingBalance);
        setIsLoading(false);
        return { 
          success: true, 
          message: `Successfully sent ${formatCurrency(amountInPaise)} to ${res.recipientName}`,
          reference: res.reference 
        };
      }
      triggerHeavyImpact();
      setIsLoading(false);
      return { success: false, message: 'Transfer failed.' };
    } catch (err: any) {
      console.error('[useWallet] Transfer error:', err);
      triggerHeavyImpact();
      setIsLoading(false);
      return { success: false, message: err.message || 'Transfer failed.' };
    }
  }, [uid]);

  // 5. Request Funds
  const requestMoney = useCallback(async (payerUid: string, amountInRupees: number, note: string): Promise<{ success: boolean; message: string; request?: any }> => {
    setIsLoading(true);
    const amountInPaise = Math.round(amountInRupees * 100);

    try {
      const res = await requestFunds(payerUid, amountInPaise, note);
      setIsLoading(false);
      if (res.status === 'success') {
        triggerSuccessNotification();
        return { success: true, message: `Requested ${formatCurrency(amountInPaise)} successfully.`, request: res.request };
      }
      return { success: false, message: 'Failed to send payment request.' };
    } catch (err: any) {
      console.error('[useWallet] Request money error:', err);
      triggerHeavyImpact();
      setIsLoading(false);
      return { success: false, message: err.message || 'Failed to send request.' };
    }
  }, []);

  // 6. Pay Request
  const payRequest = useCallback(async (requestId: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const res = await respondToRequest(requestId, 'PAY');
      if (res.status === 'success') {
        triggerSuccessNotification();
        await fetchBalanceFromDb(uid);
        setIsLoading(false);
        return { success: true, message: 'Payment request paid successfully.' };
      }
      setIsLoading(false);
      return { success: false, message: 'Failed to pay request.' };
    } catch (err: any) {
      console.error('[useWallet] Pay request error:', err);
      triggerHeavyImpact();
      setIsLoading(false);
      return { success: false, message: err.message || 'Failed to pay request.' };
    }
  }, [uid]);

  // 7. Decline Request
  const declineRequest = useCallback(async (requestId: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const res = await respondToRequest(requestId, 'DECLINE');
      setIsLoading(false);
      if (res.status === 'success') {
        triggerSuccessNotification();
        return { success: true, message: 'Payment request declined.' };
      }
      return { success: false, message: 'Failed to decline request.' };
    } catch (err: any) {
      console.error('[useWallet] Decline request error:', err);
      triggerHeavyImpact();
      setIsLoading(false);
      return { success: false, message: err.message || 'Failed to decline request.' };
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    setIsLoading(true);
    await fetchBalanceFromDb(uid);
    setIsLoading(false);
  }, [uid]);

  return {
    balance,
    formattedBalance,
    isLoading,
    transactions,
    depositFunds,
    sendMoney,
    requestMoney,
    payRequest,
    declineRequest,
    refreshBalance: forceRefresh
  };
}

function formatCurrency(amountInPaise: number) {
  return `₹${(amountInPaise / 100).toFixed(2)}`;
}
