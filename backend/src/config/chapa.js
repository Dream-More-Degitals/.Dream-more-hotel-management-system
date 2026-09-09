const axios = require('axios');

const chapa = axios.create({
  baseURL: 'https://api.chapa.co/v1',
  headers: {
    Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

async function initializeTransaction({ amount, currency, email, tx_ref, return_url }) {
  const response = await chapa.post('/transaction/initialize', {
    amount,
    currency,
    email,
    tx_ref,
    return_url,
  });
  return response.data;
}

async function verifyTransaction(tx_ref) {
  const response = await chapa.get(`/transaction/verify/${tx_ref}`);
  return response.data;
}

module.exports = { initializeTransaction, verifyTransaction };
