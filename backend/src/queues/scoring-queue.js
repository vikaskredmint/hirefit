import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

let connection;
let scoringQueue;

export function getRedisConnection() {
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
    scoringQueue = new Queue("hirefit-scoring", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 15000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    });
  }
  return scoringQueue;
}

export async function enqueueCandidateScore(candidateId, index = 0) {
  return getScoringQueue().add(
    "score-candidate",
    { candidateId },
    {
      jobId: `candidate:${candidateId}`,
      delay: index * 5000,
    },
  );
}

export async function queueCounts() {
  return getScoringQueue().getJobCounts("waiting", "delayed", "active", "failed", "completed");
}
