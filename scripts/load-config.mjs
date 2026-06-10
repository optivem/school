// Loads and validates a deployment's config/ for Optivem School.
//
// Mirrors optivem/hub's model: students, reviewers (teachers), projects, board, courses.
// Each deployment copies the *.example.json files to *.json (no ".example") and edits them;
// the real *.json are committed by the deployment (the template ships only the examples).
//
//   as a module:  import { loadConfig } from "./load-config.mjs"
//   as a CLI:      node scripts/load-config.mjs    (validates config/*.json + prints a summary)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function readJson(file) {
  if (!existsSync(file)) {
    const example = file.replace(/\.json$/, ".example.json");
    throw new Error(
      `Missing config file: ${file}\n` +
      `→ Copy ${example} to ${file} and fill it in for your deployment.`
    );
  }
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    throw new Error(`Invalid JSON in ${file}: ${e.message}`);
  }
}

export function loadConfig(rootDir) {
  const configDir = join(rootDir, "config");

  const board = readJson(join(configDir, "board.json"));
  const reviewers = readJson(join(configDir, "reviewers.json"));
  const students = readJson(join(configDir, "students.json"));
  const projects = readJson(join(configDir, "projects.json"));

  const coursesDir = join(configDir, "courses");
  const courses = (existsSync(coursesDir) ? readdirSync(coursesDir) : [])
    .filter(f => f.endsWith(".json") && !f.endsWith(".example.json"))
    .sort()
    .map(f => readJson(join(coursesDir, f)));

  return {
    title: board.title,
    reviewers,
    board: board.board,
    statuses: board.statuses,
    students,
    projects,
    courses,
  };
}

// CLI: validate + print a summary when run directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const c = loadConfig(root);
    console.log(`✓ ${c.title}`);
    console.log(`  students:  ${c.students.length}`);
    console.log(`  reviewers: ${c.reviewers.length}`);
    console.log(`  projects:  ${c.projects.length}`);
    console.log(`  courses:   ${c.courses.length} (${c.courses.map(x => x.id).join(", ")})`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
