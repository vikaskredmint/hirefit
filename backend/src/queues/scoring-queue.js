import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

let connection;
let scoringQueue;

// ── In-Memory Fallback Queue ───────────────────────────────────
class InMemoryQueue {
  constructor() {
    this.jobs = []; // { id, data, delay, status: 'waiting' | 'active' | 'completed' | 'failed', failedReason, addedAt }
    this.processing = false;
  }

  async add(name, data, options = {}) {
    const jobId = options.jobId || `job-${Date.now()}-${Math.random()}`;
    const job = {
      id: jobId,
      name,
      data,
      delay: options.delay || 0,
      status: "waiting",
      failedReason: null,
      addedAt: Date.now(),
    };
    this.jobs.push(job);
    
    // Sort jobs: scheduled run time (addedAt + delay)
    this.jobs.sort((a, b) => (a.addedAt + a.delay) - (b.addedAt + b.delay));
    
    // Trigger processing asynchronously
    this.processQueue();
    return job;
  }

  async getJobCounts() {
    const counts = { waiting: 0, delayed: 0, active: 0, failed: 0, completed: 0 };
    const now = Date.now();
    for (const job of this.jobs) {
      if (job.status === "active") counts.active++;
      else if (job.status === "completed") counts.completed++;
      else if (job.status === "failed") counts.failed++;
      else if (job.status === "waiting") {
        if (job.addedAt + job.delay > now) counts.delayed++;
        else counts.waiting++;
      }
    }
    return counts;
  }

  async getFailed(start = 0, end = 5) {
    const failedJobs = this.jobs.filter(j => j.status === "failed");
    return failedJobs.slice(start, end).map(j => ({
      id: j.id,
      data: j.data,
      failedReason: j.failedReason,
    }));
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (true) {
        const now = Date.now();
        const nextJob = this.jobs.find(
          j => j.status === "waiting" && j.addedAt + j.delay <= now
        );

        if (!nextJob) {
          // Check if there are any future waiting jobs
          const futureJob = this.jobs.find(j => j.status === "waiting");
          if (futureJob) {
            const delayMs = (futureJob.addedAt + futureJob.delay) - Date.now();
            if (delayMs > 0) {
              await new Promise(r => setTimeout(r, Math.min(delayMs, 1000)));
              continue;
            }
          }
          break; // No more jobs to process
        }

        nextJob.status = "active";
        console.log(`[InMemoryQueue] Processing job ${nextJob.id} for candidate ${nextJob.data.candidateId}`);

        try {
          // Import at runtime to avoid circular dependency
          const { scoreCandidate } = await import("../services/ai-scoring.js");
          await scoreCandidate({ candidateId: nextJob.data.candidateId });
          nextJob.status = "completed";
          console.log(`[InMemoryQueue] Job ${nextJob.id} completed successfully`);
        } catch (err) {
          nextJob.status = "failed";
          nextJob.failedReason = err.message || String(err);
          console.error(`[InMemoryQueue] Job ${nextJob.id} failed:`, nextJob.failedReason);
        }

        // Artificial spacing between jobs to respect API rate limits
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error("[InMemoryQueue] Processing loop error:", e);
    } finally {
      this.processing = false;
    }
  }
}

// ── Redis Connection & Queue Initialization ──────────────────
export function getRedisConnection() {
  if (!config.redisUrl) return null;
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    connection.on("error", (error) => {
      console.error(`Redis connection error: ${error.message}`);
    });
  }
  return connection;
}

export function getScoringQueue() {
  if (!scoringQueue) {
    if (config.redisUrl) {
      console.log("Initializing BullMQ Queue (using Redis)");
      scoringQueue = new Queue("hirefit-scoring", {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 15000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      });
    } else {
      console.log("Initializing Fallback InMemoryQueue (no Redis)");
      scoringQueue = new InMemoryQueue();
    }
  }
  return scoringQueue;
}

export async function enqueueCandidateScore(candidateId, index = 0) {
  const jobIdSafe = `candidate-${String(candidateId)}`;

  return getScoringQueue().add(
    "score-candidate",
    { candidateId },
    {
      jobId: jobIdSafe,
      delay: index * 5000,
    },
  );
}

export async function queueCounts() {
  return getScoringQueue().getJobCounts("waiting", "delayed", "active", "failed", "completed");
}
