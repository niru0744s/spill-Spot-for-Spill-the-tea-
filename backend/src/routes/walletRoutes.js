const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authenticateUser = require('../middlewares/auth');

// All wallet endpoints require authentication
router.use(authenticateUser);

// 1. Deposits (Razorpay Order creation & verification)
router.post('/order', walletController.createOrder);
router.post('/verify', walletController.verifyPayment);

// 2. Transfers (User to User)
router.post('/transfer', walletController.transferFunds);

// 3. Social Payment Requests (Request & Respond)
router.post('/request', walletController.requestFunds);
router.post('/request/respond', walletController.respondToRequest);

module.exports = router;
