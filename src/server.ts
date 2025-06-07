// File: src/server.ts
import express, { Request, Response } from 'express'; 
import { EmailService } from './services/EmailService';
import { MockProvider1 } from './providers/MockProvider1';
import { MockProvider2 } from './providers/MockProvider2';
import { EmailPayload } from './interfaces/IEmailProvider';

const app = express();
const PORT = process.env.PORT || 3000;

interface SendEmailRequestBody {
  to: string; from: string; subject: string; body: string; idempotencyKey: string;
}
interface StatusRequestParams {
  idempotencyKey: string;
}

const provider1 = new MockProvider1();
const provider2 = new MockProvider2();
const emailService = new EmailService([provider1, provider2]);

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ 
      message: 'Resilient Email Service is running!',
      endpoints: { sendEmail: 'POST /send-email', getStatus: 'GET /status/:idempotencyKey' }
  });
});

app.post('/send-email', async (req: Request<{}, {}, SendEmailRequestBody>, res: Response) => {
  const { to, from, subject, body, idempotencyKey } = req.body;
  const payload: EmailPayload = { to, from, subject, body };
  
  console.log(`Received request to send email with key: ${idempotencyKey}`);
  try {
    emailService.sendEmail(payload, idempotencyKey);
    res.status(202).json({ 
      message: 'Email request accepted and is being processed.',
      idempotencyKey,
      statusUrl: `/status/${idempotencyKey}`
    });
  } catch (error) {
    if ((error as Error).message.includes('Rate limit exceeded')) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.'});
    }
    console.error('Error in /send-email endpoint:', error);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
});

app.get('/status/:idempotencyKey', (req: Request<StatusRequestParams>, res: Response) => {
    const { idempotencyKey } = req.params;
    const status = emailService.getEmailStatus(idempotencyKey);
    if (!status) {
        return res.status(404).json({ error: `No email found with idempotency key: ${idempotencyKey}`});
    }
    res.status(200).json(status);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});