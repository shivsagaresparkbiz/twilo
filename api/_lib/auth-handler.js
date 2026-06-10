'use strict';

// No-op auth handler. This mirrors server/auth-handler.ts so the deployed token
// endpoint behaves exactly like local development.
//
// SECURITY: With this no-op handler, anyone who knows the URL can request Twilio
// access tokens against your account. Before sharing a public deployment, add a
// passcode/auth check here (and have the frontend send it). See the notes in
// vercel.json / the project README.
module.exports = () => {};
