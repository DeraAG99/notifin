import { scheduler } from "../lib/scheduler";

async function main() {
  console.log("Starting scheduler worker...");

  await scheduler.loadSchedules();

  const activeCount = scheduler.getActiveTaskCount();
  console.log(`Loaded ${activeCount} active schedules`);
  console.log("Scheduler is running. Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("\nShutting down scheduler...");
    scheduler.stopAll();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  setInterval(() => {
    const count = scheduler.getActiveTaskCount();
    console.log(`Scheduler heartbeat: ${count} active schedules`);
  }, 60000);
}

main().catch((error) => {
  console.error("Scheduler failed to start:", error);
  process.exit(1);
});
