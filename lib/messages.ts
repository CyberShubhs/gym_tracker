export const HARDCORE_MESSAGES: string[] = [
  "You are weak and pathetic. Get up.",
  "Soft body, soft life. Earn the difference.",
  "You will never get what you want if you don't change.",
  "Excuses are louder than your effort. Shut them up.",
  "The mirror is not lying. Move.",
  "Stop scrolling. Lift.",
  "You're not tired. You're undisciplined.",
  "Your future self is watching. Disgusted.",
  "Average is a choice. So is winning.",
  "Eat for the body you want, not the one you are.",
  "Pain is information. Use it.",
  "Sleep is the gym. Skip it and stay weak.",
  "You don't deserve a cheat meal you didn't bleed for.",
  "One more set. Always one more.",
  "Comfort built nothing. Discomfort built champions.",
  "You're fat because you stopped fighting. Fight today.",
  "The bar doesn't care about your feelings.",
  "Every skipped session is a step backwards.",
  "Hydrate. Protein. Train. Repeat. No shortcuts.",
  "You said you'd change. Prove it now.",
  "The work is the only thing that's real.",
  "Progress doesn't negotiate. Show up.",
  "Stop being a tourist in your own life.",
  "Your weakness is loud. Make your discipline louder.",
];

export function pickMessage(seed?: number): string {
  const i = Math.floor((seed ?? Math.random()) * HARDCORE_MESSAGES.length);
  return HARDCORE_MESSAGES[i % HARDCORE_MESSAGES.length];
}
