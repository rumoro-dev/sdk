// The OpenAPI document api.rumoro.dev serves (src/app/api/v1/openapi.json), written for the generator.
import { writeFileSync } from "node:fs";
import { publicOpenApi } from "../../../src/lib/reference.ts";

const document = publicOpenApi("https://app.rumoro.dev");
writeFileSync(new URL("../openapi.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
console.log(`openapi.json: ${Object.keys(document.paths).length} paths, server ${document.servers[0].url}`);
