#!/usr/bin/env node
// Builds dist/gmail-account-selector-<version>.zip containing exactly the files
// Chrome needs to run the extension. The version comes from manifest.json, the
// single source of truth.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const CONTENTS = ["manifest.json", "picker.html", "options.html", "styles.css", "src"];

const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
const archive = `dist/gmail-account-selector-${version}.zip`;

mkdirSync("dist", { recursive: true });
rmSync(archive, { force: true });
execFileSync("zip", ["-r", "-q", "-X", archive, ...CONTENTS], { stdio: "inherit" });

const listing = execFileSync("zip", ["-sf", archive], { encoding: "utf8" });
console.log(listing.trim());
console.log(`\nPacked ${archive}`);
