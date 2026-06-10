'use strict';

const { runServerlessFunction } = require('./_lib/twilioServerless');
const { handler } = require('@twilio-labs/plugin-rtc/src/serverless/functions/token');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'method not allowed' } });
    return;
  }
  runServerlessFunction(handler, req, res);
};
