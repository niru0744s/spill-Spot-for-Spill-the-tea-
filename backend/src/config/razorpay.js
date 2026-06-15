const Razorpay = require('razorpay');
require('dotenv').config();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret || keyId.startsWith('rzp_test_your_key_id')) {
  console.warn('[Razorpay Config] WARNING: Missing or placeholder Razorpay credentials in .env!');
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

module.exports = razorpay;
