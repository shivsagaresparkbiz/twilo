import 'dotenv/config';
import type { Request, Response } from 'express';
import type { ServerlessContext, ServerlessFunction } from './types';
import Twilio from 'twilio';

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

const context: ServerlessContext = {
  ACCOUNT_SID: TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  ROOM_TYPE: 'group',
  CONVERSATIONS_SERVICE_SID: TWILIO_CONVERSATIONS_SERVICE_SID,
  getTwilioClient: () => twilioClient,
};

export function createExpressHandler(serverlessFunction: ServerlessFunction) {
  return (req: Request, res: Response) => {
    const sendError = (error: unknown) => {
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
      // The serverless functions are `async`, so a thrown error becomes a rejected
      // promise. Catching it here prevents a single bad request (e.g. a missing or
      // invalid Conversations Service SID) from crashing the entire token server.
      const result = serverlessFunction(context, req.body, (_, serverlessResponse) => {
        const { statusCode, headers, body } = serverlessResponse;

        res
          .status(statusCode)
          .set(headers)
          .json(body);
      }) as unknown;

      if (result instanceof Promise) {
        result.catch(sendError);
      }
    } catch (error) {
      sendError(error);
    }
  };
}
