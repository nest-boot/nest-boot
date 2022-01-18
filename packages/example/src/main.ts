import "source-map-support/register";

import { startHttpServer } from "@nest-boot/common";

import { HttpModule } from "./app/http/http.module";

startHttpServer(HttpModule);
