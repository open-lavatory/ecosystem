import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

import { features } from "./descriptor.ts";

type Cell = "fail" | "pass" | "gap" | "skip";

const CELL_RANK: Record<Cell, number> = { fail: 3, pass: 2, gap: 1, skip: 0 };

const outPath = join(import.meta.dirname, "..", ".out", "matrix.md");

export default class MatrixReporter implements Reporter {
  private readonly cells = new Map<string, Map<string, Cell>>();

  onTestEnd(test: TestCase, result: TestResult) {
    const appId = test.tags.find(tag => tag.startsWith("@app:"))?.slice("@app:".length);

    if (!appId) return;

    const isGap = test.annotations.some(annotation => annotation.type === "gap");
    const passedCell: Cell = result.status === "passed" ? "pass" : "fail";
    const cell: Cell = result.status === "skipped" ? (isGap ? "gap" : "skip") : passedCell;
    const row = this.cells.get(appId) ?? new Map<string, Cell>();

    for (const tag of test.tags.filter(candidate => candidate.startsWith("@feature:"))) {
      const feature = tag.slice("@feature:".length);
      const previous = row.get(feature);

      if (!previous || CELL_RANK[cell] > CELL_RANK[previous]) row.set(feature, cell);
    }

    this.cells.set(appId, row);
  }

  onEnd() {
    const lines = [
      `| app | ${features.join(" | ")} |`,
      `| --- |${features.map(() => " --- |").join("")}`,
      ...[...this.cells].map(([appId, row]) => `| ${appId} | ${features.map(feature => row.get(feature) ?? "n/a").join(" | ")} |`),
    ];

    mkdirSync(join(outPath, ".."), { recursive: true });
    writeFileSync(outPath, `${lines.join("\n")}\n`);
    console.log(`\n${lines.join("\n")}\n\nmatrix written to ${outPath}`);
  }
}
