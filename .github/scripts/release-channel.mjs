import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Changesets owns version calculation. This only protects our branch/channel
// boundary, especially when beta has just been synchronized from main.
export function checkReleaseChannel(
  branch,
  { cwd = process.cwd(), publish = false } = {},
) {
  const read = (path) => JSON.parse(readFileSync(join(cwd, path), "utf8"));
  const pre = existsSync(join(cwd, ".changeset/pre.json"))
    ? read(".changeset/pre.json")
    : undefined;
  const manifests = readdirSync(join(cwd, "packages"))
    .filter((name) => existsSync(join(cwd, "packages", name, "package.json")))
    .map((name) => read(`packages/${name}/package.json`))
    .filter((manifest) => !manifest.private);

  if (branch === "beta") {
    if (pre?.mode !== "pre" || pre.tag !== "beta") {
      throw new Error(
        "On beta, synchronize main and run pnpm changeset pre enter beta before releasing. Promote pre exit changes to main.",
      );
    }
  } else if (branch === "main") {
    if (pre && (publish || pre.mode !== "exit")) {
      throw new Error(
        "On main, exit prerelease mode and merge the stable version PR before publishing.",
      );
    }
    if (!pre && manifests.some(({ version }) => version.includes("-"))) {
      throw new Error(
        "Prerelease manifests on main require Changesets pre exit state before versioning.",
      );
    }
  } else {
    throw new Error(`Unsupported release branch: ${branch}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkReleaseChannel(process.argv[2], {
    publish: process.argv.includes("--publish"),
  });
}
