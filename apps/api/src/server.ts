import { buildApp } from "./app";
import { loadConfig } from "./config";
import { runMigrations } from "./db/migrate";
import { expireDueBills } from "./services/bills";

const config = loadConfig();
await runMigrations(config.databaseUrl);
const { app, ctx } = await buildApp({ config });

// Close bills that passed their expiry date, every 10 minutes.
const timer = setInterval(() => {
  expireDueBills(ctx).catch((err) => app.log.error(err, "expiry sweep failed"));
}, 10 * 60_000);
app.addHook("onClose", async () => clearInterval(timer));

await app.listen({ port: config.port, host: "0.0.0.0" });
app.log.info(`Billy API on port ${config.port} (payments: ${ctx.payments.name})`);
