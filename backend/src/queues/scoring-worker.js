import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./scoring-queue.js";
import { scoreCandidate } from "../services/ai-scoring.js";
import { config } from "../config.js";

export let scoringWorker = null;

if (config.redisUrl) {
  console.log("Starting BullMQ Background Worker (using Redis)");
  scoringWorker = new Worker(
    "hirefit-scoring",
    async (job) => {
      const result = await scoreCandidate({ candidateId: job.data.candidateId });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  scoringWorker.on("completed", (job) => {
    console.log(`Scored candidate job ${job.id}`);
  });

  scoringWorker.on("failed", (job, error) => {
    console.error(`Scoring job ${job?.id || "unknown"} failed:`, error.message);
  });
} else {
  console.log("Skipping BullMQ Worker initialization (in-memory mode is active)");
}
