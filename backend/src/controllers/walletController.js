const crypto = require('crypto');
const { db, admin } = require('../config/firebase');
const razorpay = require('../config/razorpay');

/**
 * Helper: Converts amount to formatted currency string (INR)
 */
function formatCurrency(amountInPaise) {
  return `₹${(amountInPaise / 100).toFixed(2)}`;
}

/**
 * 1. Create Razorpay Order (for Adding Funds)
 */
exports.createOrder = async (req, res) => {
  const { amount } = req.body; // Amount in Rupees (e.g. 500)
  const uid = req.user.uid;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount.' });
  }

  // Convert to paise (Razorpay expects smallest currency unit)
  const amountInPaise = Math.round(amount * 100);
  const receiptId = `deposit_${uid.substring(0, 8)}_${Date.now()}`;

  try {
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
    };

    const order = await razorpay.orders.create(options);
    
    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('[Wallet Controller] Create Order Error:', error);
    return res.status(500).json({
      error: 'Failed to create payment order.',
      details: error.message
    });
  }
};

/**
 * 2. Verify Razorpay Payment Signature & Credit Wallet
 */
exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const uid = req.user.uid;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment signature verification parameters.' });
  }

  // Validate the Razorpay signature locally using HMAC-SHA256
  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
  const generatedSignature = hmac.digest('hex');

  if (generatedSignature !== razorpay_signature) {
    console.warn(`[Wallet Controller] Signature mismatch for user ${uid}!`);
    return res.status(400).json({ error: 'Payment signature verification failed. Possible fraud attempt.' });
  }

  try {
    // Fetch order details from Razorpay to verify the exact amount securely
    const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
    const amountCredited = orderDetails.amount; // in paise

    const walletRef = db.collection('wallets').doc(uid);
    const transactionId = `tx_${razorpay_payment_id}`;
    const transactionRef = db.collection('walletTransactions').doc(transactionId);

    // Execute Firestore Transaction
    await db.runTransaction(async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      let newBalance = amountCredited;

      if (walletDoc.exists) {
        newBalance = walletDoc.data().balance + amountCredited;
        transaction.update(walletRef, {
          balance: newBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(walletRef, {
          uid,
          balance: newBalance,
          currency: 'INR',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Record credit ledger transaction
      transaction.set(transactionRef, {
        id: transactionId,
        userId: uid,
        amount: amountCredited,
        type: 'ADD_FUNDS',
        status: 'SUCCESS',
        reference: razorpay_payment_id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(`[Wallet Controller] Wallet credited: ${formatCurrency(amountCredited)} for user ${uid}`);

    return res.status(200).json({
      status: 'success',
      message: 'Payment verified and wallet credited successfully.',
      credited: amountCredited,
    });
  } catch (error) {
    console.error('[Wallet Controller] Verify Payment Transaction Error:', error);
    return res.status(500).json({
      error: 'Internal ledger error.',
      details: error.message
    });
  }
};

/**
 * 3. Transfer Funds (User to User) - Safe Transactional Logic
 */
exports.transferFunds = async (req, res) => {
  const { receiverUid, amount } = req.body; // amount in paise
  const senderUid = req.user.uid;

  if (!receiverUid) {
    return res.status(400).json({ error: 'Receiver UID is required.' });
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer amount.' });
  }
  if (senderUid === receiverUid) {
    return res.status(400).json({ error: 'Cannot transfer funds to yourself.' });
  }

  try {
    const senderWalletRef = db.collection('wallets').doc(senderUid);
    const receiverWalletRef = db.collection('wallets').doc(receiverUid);
    const receiverUserRef = db.collection('users').doc(receiverUid);

    const transactionId = `tx_tr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const senderTxRef = db.collection('walletTransactions').doc(`${transactionId}_debit`);
    const receiverTxRef = db.collection('walletTransactions').doc(`${transactionId}_credit`);

    const result = await db.runTransaction(async (transaction) => {
      // 1. Get receiver user profile to verify they exist
      const receiverUserDoc = await transaction.get(receiverUserRef);
      if (!receiverUserDoc.exists) {
        throw new Error('Receiver user profile not found.');
      }
      const receiverName = receiverUserDoc.data().name || 'Spill User';

      // 2. Get sender wallet and verify balance
      const senderWalletDoc = await transaction.get(senderWalletRef);
      if (!senderWalletDoc.exists || senderWalletDoc.data().balance < amount) {
        throw new Error('Insufficient wallet balance.');
      }

      // 3. Get receiver wallet
      const receiverWalletDoc = await transaction.get(receiverWalletRef);

      // 4. Update Sender Wallet Balance
      const senderNewBalance = senderWalletDoc.data().balance - amount;
      transaction.update(senderWalletRef, {
        balance: senderNewBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Update Receiver Wallet Balance
      let receiverNewBalance = amount;
      if (receiverWalletDoc.exists) {
        receiverNewBalance = receiverWalletDoc.data().balance + amount;
        transaction.update(receiverWalletRef, {
          balance: receiverNewBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(receiverWalletRef, {
          uid: receiverUid,
          balance: receiverNewBalance,
          currency: 'INR',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // 6. Write Debit Ledger Log for Sender
      transaction.set(senderTxRef, {
        id: `${transactionId}_debit`,
        userId: senderUid,
        counterpartyId: receiverUid,
        counterpartyName: receiverName,
        amount: -amount, // Negative for debit
        type: 'SEND_FUNDS',
        status: 'SUCCESS',
        reference: transactionId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 7. Write Credit Ledger Log for Receiver
      transaction.set(receiverTxRef, {
        id: `${transactionId}_credit`,
        userId: receiverUid,
        counterpartyId: senderUid,
        counterpartyName: req.user.name || 'Spill Friend',
        amount: amount, // Positive for credit
        type: 'RECEIVE_FUNDS',
        status: 'SUCCESS',
        reference: transactionId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        senderBalance: senderNewBalance,
        receiverName,
      };
    });

    console.log(`[Wallet Controller] Transfer successful: ${formatCurrency(amount)} from ${senderUid} to ${receiverUid}`);

    return res.status(200).json({
      status: 'success',
      message: 'Transfer completed successfully.',
      amount: amount,
      remainingBalance: result.senderBalance,
      recipientName: result.receiverName,
      reference: transactionId,
    });
  } catch (error) {
    console.error('[Wallet Controller] Transfer Funds Error:', error.message);
    const statusCode = error.message.includes('Insufficient') || error.message.includes('not found') ? 400 : 500;
    return res.status(statusCode).json({
      error: 'Transfer failed.',
      message: error.message,
    });
  }
};

/**
 * 4. Request Funds (Social Request Creation)
 */
exports.requestFunds = async (req, res) => {
  const { payerUid, amount, note } = req.body; // amount in paise
  const requesterUid = req.user.uid;
  const requesterName = req.user.name || 'Spill Friend';

  if (!payerUid) {
    return res.status(400).json({ error: 'Payer UID is required.' });
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid request amount.' });
  }
  if (requesterUid === payerUid) {
    return res.status(400).json({ error: 'Cannot request money from yourself.' });
  }

  try {
    // Check if target payer profile exists
    const payerDoc = await db.collection('users').doc(payerUid).get();
    if (!payerDoc.exists) {
      return res.status(404).json({ error: 'Payer user profile not found.' });
    }

    const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const requestRef = db.collection('paymentRequests').doc(requestId);

    const requestData = {
      id: requestId,
      requesterUid,
      requesterName,
      payerUid,
      amount,
      note: note || '',
      status: 'PENDING',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await requestRef.set(requestData);

    console.log(`[Wallet Controller] Payment request created: ${requestId} for ${formatCurrency(amount)}`);

    return res.status(200).json({
      status: 'success',
      message: 'Payment request sent successfully.',
      request: requestData,
    });
  } catch (error) {
    console.error('[Wallet Controller] Request Funds Error:', error);
    return res.status(500).json({
      error: 'Failed to create payment request.',
      details: error.message,
    });
  }
};

/**
 * 5. Respond to Request (Pay or Decline)
 */
exports.respondToRequest = async (req, res) => {
  const { requestId, action } = req.body; // action: "PAY" or "DECLINE"
  const payerUid = req.user.uid;

  if (!requestId || !action || !['PAY', 'DECLINE'].includes(action)) {
    return res.status(400).json({ error: 'Request ID and valid action (PAY/DECLINE) are required.' });
  }

  try {
    const requestRef = db.collection('paymentRequests').doc(requestId);
    const payerWalletRef = db.collection('wallets').doc(payerUid);

    const transactionId = `tx_tr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const payerTxRef = db.collection('walletTransactions').doc(`${transactionId}_debit`);
    const requesterTxRef = db.collection('walletTransactions').doc(`${transactionId}_credit`);

    const result = await db.runTransaction(async (transaction) => {
      // 1. Get the payment request document
      const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists) {
        throw new Error('Payment request not found.');
      }

      const requestData = requestDoc.data();
      if (requestData.payerUid !== payerUid) {
        throw new Error('You are not authorized to respond to this payment request.');
      }
      if (requestData.status !== 'PENDING') {
        throw new Error(`This request has already been ${requestData.status.toLowerCase()}.`);
      }

      const requesterUid = requestData.requesterUid;
      const requesterName = requestData.requesterName;
      const amount = requestData.amount;

      if (action === 'DECLINE') {
        transaction.update(requestRef, {
          status: 'DECLINED',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { action, status: 'DECLINED' };
      }

      // Action is "PAY"
      const requesterWalletRef = db.collection('wallets').doc(requesterUid);

      // 2. Read payer wallet and check balance
      const payerWalletDoc = await transaction.get(payerWalletRef);
      if (!payerWalletDoc.exists || payerWalletDoc.data().balance < amount) {
        throw new Error('Insufficient wallet balance to pay this request.');
      }

      // 3. Read requester wallet
      const requesterWalletDoc = await transaction.get(requesterWalletRef);

      // 4. Update Payer Wallet Balance
      const payerNewBalance = payerWalletDoc.data().balance - amount;
      transaction.update(payerWalletRef, {
        balance: payerNewBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Update Requester Wallet Balance
      let requesterNewBalance = amount;
      if (requesterWalletDoc.exists) {
        requesterNewBalance = requesterWalletDoc.data().balance + amount;
        transaction.update(requesterWalletRef, {
          balance: requesterNewBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(requesterWalletRef, {
          uid: requesterUid,
          balance: requesterNewBalance,
          currency: 'INR',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // 6. Write Debit Ledger Log for Payer
      transaction.set(payerTxRef, {
        id: `${transactionId}_debit`,
        userId: payerUid,
        counterpartyId: requesterUid,
        counterpartyName: requesterName,
        amount: -amount,
        type: 'SEND_FUNDS',
        status: 'SUCCESS',
        reference: `request_${requestId}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 7. Write Credit Ledger Log for Requester
      transaction.set(requesterTxRef, {
        id: `${transactionId}_credit`,
        userId: requesterUid,
        counterpartyId: payerUid,
        counterpartyName: req.user.name || 'Spill Friend',
        amount: amount,
        type: 'RECEIVE_FUNDS',
        status: 'SUCCESS',
        reference: `request_${requestId}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 8. Update Payment Request status to PAID
      transaction.update(requestRef, {
        status: 'PAID',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        action,
        status: 'PAID',
        amount,
        remainingBalance: payerNewBalance,
        requesterName,
        reference: transactionId,
      };
    });

    console.log(`[Wallet Controller] Payment request ${requestId} responded: ${action}`);

    return res.status(200).json({
      status: 'success',
      message: `Request ${action === 'PAY' ? 'paid' : 'declined'} successfully.`,
      result,
    });
  } catch (error) {
    console.error('[Wallet Controller] Respond to Request Error:', error.message);
    const statusCode = error.message.includes('Insufficient') || error.message.includes('authorized') || error.message.includes('already') ? 400 : 500;
    return res.status(statusCode).json({
      error: 'Failed to process request response.',
      message: error.message,
    });
  }
};
