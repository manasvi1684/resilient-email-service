import { IEmailProvider, EmailPayload } from '../interfaces/IEmailProvider';

// Simulates a more reliable provider
export class MockProvider2 implements IEmailProvider {
  private name = 'SendGrid-Simulator';

  public getName(): string {
    return this.name;
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; providerName: string }> {
    console.log(`Attempting to send email via ${this.name}...`);
    return new Promise((resolve) => {
      // Simulate a reliable network request
      setTimeout(() => {
        console.log(`✅ Email sent successfully via ${this.name}.`);
        resolve({ success: true, providerName: this.name });
      }, 300);
    });
  }
}