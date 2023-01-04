import { databaseConfig } from "@nest-boot/database";

export default databaseConfig({
  debug: true,
  driverOptions: {
    connection: { application_name: process.env.APP_NAME },
  },
});
