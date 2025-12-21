export type TelegramForm = {
  token: string;
  requireMention: boolean;
  allowFrom: string;
  proxy: string;
  webhookUrl: string;
  webhookSecret: string;
  webhookPath: string;
};

export type CronFormState = {
  name: string;
  description: string;
  enabled: boolean;
  scheduleKind: "at" | "every" | "cron";
  scheduleAt: string;
  everyAmount: string;
  everyUnit: "minutes" | "hours" | "days";
  cronExpr: string;
  cronTz: string;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payloadKind: "systemEvent" | "agentTurn";
  payloadText: string;
  deliver: boolean;
  channel: "last" | "whatsapp" | "telegram";
  to: string;
  timeoutSeconds: string;
  postToMainPrefix: string;
};

