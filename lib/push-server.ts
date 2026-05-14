import webpush from "web-push";

let configured = false;

function configure() {
  if (configured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID env vars missing");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type StoredSubscription = webpush.PushSubscription;

export async function sendPush(
  subscription: StoredSubscription,
  body: string,
  title = "Gym Tracker"
): Promise<void> {
  configure();
  await webpush.sendNotification(
    subscription,
    JSON.stringify({ title, body })
  );
}

export function pushStatusCode(err: unknown): number | undefined {
  return (err as { statusCode?: number }).statusCode;
}
