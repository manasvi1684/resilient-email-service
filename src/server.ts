// File: src/server.ts

// --- Dependencies ---
// Import the Express framework for building the web server.
// We specifically destructure the Request and Response types for strong type-checking in our route handlers.
import express, { Request, Response } from 'express'; 
import { EmailService } from './services/EmailService';
import { MockProvider1 } from './providers/MockProvider1';
import { MockProvider2 } from './providers/MockProvider2';
import { EmailPayload } from './interfaces/IEmailProvider';

// --- Application Setup ---
const app = express();
// Define the port for the server. Use the port from environment variables (essential for cloud platforms like Render/Heroku)
// or default to 3000 for local development.
const PORT = process.env.PORT || 3000;

// --- Type Definitions for API Contracts ---
// Define a TypeScript interface for the expected JSON body of the POST /send-email request.
// This provides compile-time type safety and autocompletion for `req.body`.
interface SendEmailRequestBody {
  to: string; from: string; subject: string; body: string; idempotencyKey: string;
}
// Define an interface for the expected URL parameters of the GET /status/:idempotencyKey request.
// This makes accessing `req.params` type-safe.
interface StatusRequestParams {
  idempotencyKey: string;
}

// --- Service Instantiation ---
// Create instances of our mock email providers.
const provider1 = new MockProvider1();
const provider2 = new MockProvider2();
// Instantiate the core EmailService. We are injecting the providers (Dependency Injection),
// which makes our service flexible and easy to test with different providers.
const emailService = new EmailService([provider1, provider2]);

// --- Middleware ---
// Use the express.json() middleware. This is crucial for parsing incoming requests with JSON payloads.
// It populates the `req.body` object.
app.use(express.json());

// --- API Endpoints (Routes) ---

/**
 * Root Endpoint (GET /)
 * A simple health-check or discovery endpoint to confirm the service is running.
 */
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ 
      message: 'Resilient Email Service is running!',
      endpoints: { sendEmail: 'POST /send-email', getStatus: 'GET /status/:idempotencyKey' }
  });
});

/**
 * Send Email Endpoint (POST /send-email)
 * Accepts an email request and hands it off to the EmailService for processing.
 */
app.post('/send-email', async (req: Request<{}, {}, SendEmailRequestBody>, res: Response) => {
  // Destructure the required fields from the validated request body.
  const { to, from, subject, body, idempotencyKey } = req.body;
  // Create the email payload object to pass to the service.
  const payload: EmailPayload = { to, from, subject, body };
  
  console.log(`Received request to send email with key: ${idempotencyKey}`);
  
  try {
    // Crucially, we do **not** `await` the `emailService.sendEmail` call.
    // This makes the endpoint asynchronous, mimicking a queue system. The server accepts
    // the job and immediately responds to the client without making them wait.
    emailService.sendEmail(payload, idempotencyKey);

    // Respond with a `202 Accepted` status. This is the correct HTTP semantic for
    // a request that has been accepted for processing but is not yet complete.
    res.status(202).json({ 
      message: 'Email request accepted and is being processed.',
      idempotencyKey,
      statusUrl: `/status/${idempotencyKey}` // Provide a URL to check the status later.
    });
  } catch (error) {
    // Provide specific error handling for known, controllable errors like rate limiting.
    if ((error as Error).message.includes('Rate limit exceeded')) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.'});
    }
    // For any other unexpected errors, log them for debugging and return a generic server error.
    console.error('Error in /send-email endpoint:', error);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
});

/**
 * Get Email Status Endpoint (GET /status/:idempotencyKey)
 * Allows clients to check the final status of an email sending request.
 */
app.get('/status/:idempotencyKey', (req: Request<StatusRequestParams>, res: Response) => {
    // The `:idempotencyKey` in the route path is a URL parameter.
    // We access it from `req.params`, which is type-safe thanks to our `StatusRequestParams` interface.
    const { idempotencyKey } = req.params;
    const status = emailService.getEmailStatus(idempotencyKey);

    // If no email record is found for the given key, return a 404 Not Found error.
    if (!status) {
        return res.status(404).json({ error: `No email found with idempotency key: ${idempotencyKey}`});
    }

    // If a record is found, return it with a 200 OK status.
    res.status(200).json(status);
});

// --- Server Activation ---
// Start the Express server and make it listen for incoming connections on the defined port.
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});