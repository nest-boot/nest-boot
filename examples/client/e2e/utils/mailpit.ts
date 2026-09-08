import { expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const mailpitUrl =
  process.env.CLIENT_E2E_MAILPIT_URL ?? "http://127.0.0.1:38025";

interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: Array<{ Address: string }>;
}

export async function waitForEmailUrl(
  request: APIRequestContext,
  email: string,
  subject: string,
): Promise<string> {
  const timeoutAt = Date.now() + 10_000;

  while (Date.now() < timeoutAt) {
    const messagesResponse = await request.get(`${mailpitUrl}/api/v1/messages`);
    expect(messagesResponse.ok()).toBeTruthy();
    const { messages } = (await messagesResponse.json()) as {
      messages: Array<MailpitMessageSummary>;
    };
    const message = messages.find(
      (candidate) =>
        candidate.Subject === subject &&
        candidate.To.some((recipient) => recipient.Address === email),
    );

    if (message) {
      const messageResponse = await request.get(
        `${mailpitUrl}/api/v1/message/${message.ID}`,
      );
      expect(messageResponse.ok()).toBeTruthy();
      const body = (await messageResponse.json()) as { Text: string };
      const url = /https?:\/\/\S+/u.exec(body.Text)?.[0];

      if (url) return url;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`${subject} email was not received for ${email}`);
}
