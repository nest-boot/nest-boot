import { runMigrations } from 'bullmq';
import { Client } from 'pg';

// Run application migrations first: they create the authenticated request role.
const client = new Client({
  connectionString: process.env.QUEUE_DATABASE_URL ?? process.env.DATABASE_URL,
});
await client.connect();
try {
  await runMigrations(client);
  await client.query('grant usage on schema bullmq to authenticated');
  await client.query('grant select on bullmq.job to authenticated');
} finally {
  await client.end();
}
