import { Queue, Worker, type Job, type QueueOptions, type WorkerOptions } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function createConnection() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export type NotificationJobData = {
  type: "send-wa" | "send-email" | "batch-send";
  logId: string;
  templateId: string;
  userId: string;
  channel: "wa" | "email" | "both";
  priority: "urgent" | "normal" | "low";
  content: { text: string; html?: string };
  subject?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
};

const QUEUE_NAMES = {
  whatsapp: "whatsapp-queue",
  email: "email-queue",
  scheduled: "scheduled-queue",
} as const;

const QUEUE_OPTIONS: QueueOptions = {
  connection: createConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
};

const WORKER_OPTIONS: WorkerOptions = {
  connection: createConnection(),
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 60000,
  },
};

export const whatsappQueue = new Queue<NotificationJobData>(
  QUEUE_NAMES.whatsapp,
  {
    ...QUEUE_OPTIONS,
    defaultJobOptions: {
      ...QUEUE_OPTIONS.defaultJobOptions,
      priority: 2,
    },
  }
);

export const emailQueue = new Queue<NotificationJobData>(
  QUEUE_NAMES.email,
  QUEUE_OPTIONS
);

export const scheduledQueue = new Queue<NotificationJobData>(
  QUEUE_NAMES.scheduled,
  QUEUE_OPTIONS
);

function getPriorityValue(priority: "urgent" | "normal" | "low"): number {
  switch (priority) {
    case "urgent":
      return 1;
    case "normal":
      return 2;
    case "low":
      return 3;
    default:
      return 2;
  }
}

export async function addNotificationJob(
  data: NotificationJobData
): Promise<Job<NotificationJobData> | Job<NotificationJobData>[]> {
  if (data.channel === "both") {
    const waJob = await whatsappQueue.add(
      `send-wa-${data.logId || Date.now()}` as string,
      { ...data, channel: "wa", type: "send-wa" },
      { priority: getPriorityValue(data.priority) }
    );
    const emailJob = await emailQueue.add(
      `send-email-${data.logId || Date.now()}` as string,
      { ...data, channel: "email", type: "send-email" },
      { priority: getPriorityValue(data.priority) }
    );
    return [waJob as Job<NotificationJobData>, emailJob as Job<NotificationJobData>];
  }

  const queue = data.channel === "wa" ? whatsappQueue : emailQueue;
  const job = await queue.add(
    `${data.type}-${data.logId || Date.now()}` as string,
    data,
    {
      priority: getPriorityValue(data.priority),
    }
  );
  return job as Job<NotificationJobData>;
}

export async function addBatchJobs(
  jobs: NotificationJobData[]
): Promise<(Job<NotificationJobData> | Job<NotificationJobData>[])[]> {
  const results = await Promise.all(
    jobs.map((data) => addNotificationJob(data))
  );
  return results;
}

export function createWorker(
  queueName: string,
  processor: (job: Job<NotificationJobData>) => Promise<void>
): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(queueName, processor, {
    ...WORKER_OPTIONS,
    concurrency: queueName === QUEUE_NAMES.email ? 20 : 10,
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed in ${queueName}:`, error.message);
  });

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed in ${queueName}`);
  });

  return worker;
}

export async function getQueueStats(queueName: string) {
  const queue =
    queueName === QUEUE_NAMES.whatsapp
      ? whatsappQueue
      : queueName === QUEUE_NAMES.email
        ? emailQueue
        : scheduledQueue;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

export async function getAllQueueStats() {
  const [whatsapp, email, scheduled] = await Promise.all([
    getQueueStats(QUEUE_NAMES.whatsapp),
    getQueueStats(QUEUE_NAMES.email),
    getQueueStats(QUEUE_NAMES.scheduled),
  ]);

  return { whatsapp, email, scheduled };
}

export { QUEUE_NAMES };
