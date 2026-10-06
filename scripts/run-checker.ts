// Runs ONE checker pass on your own computer (the same job the scheduler triggers online).
//   npm run check
// Handy for testing, or to schedule yourself (Windows Task Scheduler / cron) without deploying.
// Uses the settings in your .env file. Keep the interval at 15 minutes or more.
import "dotenv/config";
import { runChecker } from "../services/checker/run";

runChecker()
  .then((summary) => {
    console.log("Checker finished:", JSON.stringify(summary));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Checker failed:", (error as Error).message);
    process.exit(1);
  });
