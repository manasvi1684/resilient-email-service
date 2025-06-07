export interface EmailPayload {
    to: string;
    from: string;
    subject: string;
    body: string;
  }
  
  export interface IEmailProvider {
    send(payload: EmailPayload): Promise<{ success: boolean; providerName: string }>;
    getName(): string;
  }