import { runMigrations } from 'bullmq';
import { Client } from 'pg';

// Bootstrap BullMQ before application migrations add indexes and request-role grants.
const client = new Client({
  connectionString: process.env.QUEUE_DATABASE_URL ?? process.env.DATABASE_URL,
});
await client.connect();
try {
  await runMigrations(client);
} finally {
  await client.end();
}
