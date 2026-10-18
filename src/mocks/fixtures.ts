import demo from "./demo.json";

import type { Database } from "@/domain/types";

/** A fresh copy of the demo database generated from data/demo/*.csv. */
export function buildSeed(): Database {
  return JSON.parse(JSON.stringify(demo)) as Database;
}
