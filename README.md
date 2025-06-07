
# Resilient Email Service

This project is a Node.js/TypeScript implementation of a resilient email sending service designed to handle provider failures gracefully. It includes features like automatic retries with exponential backoff, fallback to a secondary provider, idempotency, rate limiting, and status tracking.

**Live Demo URL:**(https://resilient-email-service-lu49.onrender.com)

---

## Features

- **Retry Mechanism:** Automatically retries sending an email on failure with exponential backoff.
- **Provider Fallback:** Switches to a secondary provider if the primary one fails after all retry attempts.
- **Idempotency:** Prevents sending the same email twice using a unique `idempotencyKey`.
- **Rate Limiting:** In-memory rate limiting to prevent spamming (5 requests per 10 seconds).
- **Status Tracking:** Provides an endpoint to check the status of an email sending request.

## Tech Stack

- **Language:** TypeScript
- **Framework:** Node.js / Express.js
- **Testing:** Jest & ts-jest

## API Endpoints

### Send an Email

- **URL:** `/send-email`
- **Method:** `POST`
- **Body (JSON):**
  ```json
  {
    "to": "user@example.com",
    "from": "system@service.com",
    "subject": "Your Order",
    "body": "Your order has been shipped!",
    "idempotencyKey": "unique-key-for-this-email-123"
  }
Use code with caution.
Markdown
Success Response (202 Accepted):
{
  "message": "Email request accepted and is being processed.",
  "idempotencyKey": "unique-key-for-this-email-123",
  "statusUrl": "/status/unique-key-for-this-email-123"
}
Use code with caution.
Json
Get Email Status
URL: /status/:idempotencyKey
Method: GET
Success Response (200 OK):
{
    "id": "a-unique-uuid-generated-by-service",
    "status": "sent",
    "attempts": 1,
    "provider": "MailGun-Simulator",
    "lastAttempt": "2023-10-27T10:00:00.000Z",
    "idempotencyKey": "unique-key-for-this-email-123"
}
Use code with caution.
Json
Setup and Run Locally
Clone the repository:
git clone <your-repo-url>
cd resilient-email-service
Use code with caution.
Bash
Install dependencies:
npm install
Use code with caution.
Bash
Run the development server:
npm run dev
Use code with caution.
Bash
The server will be running at http://localhost:3000.
Run tests:
npm test
Use code with caution.
Bash
Architectural Notes & Assumptions
This implementation uses in-memory storage for idempotency keys, status tracking, and rate limiting. This state will be lost if the server restarts.
Production Recommendation: For a production environment, this in-memory state should be moved to an external, persistent data store like Redis or a database. This would make the application stateless and horizontally scalable.
