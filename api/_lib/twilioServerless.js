'use strict';

const Twilio = require('twilio');

// Statically require the auth handler so Vercel's dependency tracer bundles it,
// then resolve its real on-disk path for the plugin-rtc Runtime shim below.
require('./auth-handler');
const AUTH_HANDLER_PATH = require.resolve('./auth-handler');

// The @twilio-labs/plugin-rtc serverless functions expect Twilio Functions globals
// (`Twilio` and `Runtime`). We recreate the minimal pieces they use, matching
// server/bootstrap-globals.ts.
class TwilioResponse {
  constructor() {
    this.headers = {};
    this.body = undefined;
    this.statusCode = 200;
  }
  setStatusCode(code) {
    this.statusCode = code;
  }
  setBody(body) {
    this.body = body;
  }
  appendHeader(key, value) {
    this.headers[key] = value;
  }
  setHeaders(headers) {
    this.headers = headers;
  }
}

global.Twilio = Twilio;
global.Twilio.Response = TwilioResponse;
global.Runtime = {
  getAssets: () => ({
    '/auth-handler.js': { path: AUTH_HANDLER_PATH },
  }),
};

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  TWILIO_CONVERSATIONS_SERVICE_SID,
  REACT_APP_TWILIO_ENVIRONMENT,
} = process.env;

const twilioClient = Twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
  accountSid: TWILIO_ACCOUNT_SID,
  region: REACT_APP_TWILIO_ENVIRONMENT === 'prod' ? undefined : REACT_APP_TWILIO_ENVIRONMENT,
});

// Matches the context built in server/createExpressHandler.ts.
const context = {
  ACCOUNT_SID: TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  ROOM_TYPE: process.env.ROOM_TYPE || 'group',
  CONVERSATIONS_SERVICE_SID: TWILIO_CONVERSATIONS_SERVICE_SID,
  getTwilioClient: () => twilioClient,
};

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return {};
}

// Runs a plugin-rtc serverless handler inside a Vercel Node function, translating
// the Twilio callback/response shape to the Vercel res object. Errors are caught
// and returned as JSON 500s so a bad request can never crash the function.
function runServerlessFunction(handler, req, res) {
  const sendError = error => {
    console.error('Error in serverless function:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: 'server error',
          explanation: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  try {
    const event = parseBody(req);

    // Defensive guard: creating a conversation requires a valid Conversations
    // Service SID. If one isn't configured, skip conversation creation instead of
    // letting the Twilio SDK throw and turn into a 500. Video tokens still work.
    if (event && event.create_conversation && !context.CONVERSATIONS_SERVICE_SID) {
      console.warn('create_conversation requested but no CONVERSATIONS_SERVICE_SID is set; skipping conversation.');
      event.create_conversation = false;
    }

    const callback = (_, serverlessResponse) => {
      const { statusCode, headers, body } = serverlessResponse;
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
      }
      res.status(statusCode).json(body);
    };

    const result = handler(context, event, callback);
    if (result instanceof Promise) {
      result.catch(sendError);
    }
  } catch (error) {
    sendError(error);
  }
}

module.exports = { runServerlessFunction };
