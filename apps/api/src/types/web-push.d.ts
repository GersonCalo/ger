declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface RequestDetails {
    audience?: string;
    subject?: string;
    privateKey?: string;
  }

  interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  function sendNotification(subscription: PushSubscription, payload: string, options?: RequestDetails): Promise<SendResult>;
  function generateVAPIDKeys(): { publicKey: string; privateKey: string };

  export { setVapidDetails, sendNotification, generateVAPIDKeys };
  export default { setVapidDetails, sendNotification, generateVAPIDKeys };
}
