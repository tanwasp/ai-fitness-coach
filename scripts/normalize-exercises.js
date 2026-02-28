#!/usr/bin/env node
"use strict";
const fs = require("fs");

const CSV_PATH = process.env.DATA_DIR
  ? require("path").join(process.env.DATA_DIR, "tanish", "training_log.csv")
  : "/home/tanishwasp/Documents/Dev/ai-fitness-coach/.local/data/tanish/training_log.csv";

const MAP = {
  "Football (soccer)": "Football",
  "Warm-up (general)": "General Warm-Up",
  "Push-ups": "Push Up",
  "Push-up": "Push Up",
  "Pull-up": "Pull-Up",
  "Ab roll-out": "Ab Wheel Rollout",
  "Leg Raises": "Leg Raise",
  "Assisted Dip (machine)": "Assisted Dip",
  "Side plank": "Side Plank",
  "Barbell Squat": "Back Squat",
};

const text = fs.readFileSync(CSV_PATH, "utf8");
const lines = text.split("\n");
const header = lines[0];
const cols = header.split(",");
const exIdx = cols.indexOf("exercise");

if (exIdx === -1) {
  console.error("'exercise' column not found in header:", header);
  process.exit(1);
}

let changed = 0;
const out = lines.map((line, i) => {
  if (i === 0 || !line.trim()) return line;

  // Simple CSV field parser (handles double-quoted fields)
  const fields = [];
  let cur = "", inQ = false;
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    if (ch === '"') { inQ = !inQ; cur += ch; }
    else if (ch === "," && !inQ) { fields.push(cur); cur = ""; }
    else cur += ch;
  }
  fields.push(cur);

  const raw = fields[exIdx];
  const old = raw ? raw.replace(/^"|"$/g, "").trim() : "";
  if (old && MAP[old]) {
    fields[exIdx] = MAP[old];
    console.log(`  [row ${i}] "${old}" → "${MAP[old]}"`);
    changed++;
    return fields.join(",");
  }
  return line;
});

fs.writeFileSync(CSV_PATH, out.join("\n"), "utf8");
console.log(`\nDone. ${changed} cell(s) updated.`);
