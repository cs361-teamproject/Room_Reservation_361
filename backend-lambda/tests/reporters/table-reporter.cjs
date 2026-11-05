/**
 * Prints every test as one row of a table after the run:
 *   | # | Group | Case | Result |
 * Group = the describe() block, Case = the test() title.
 * On GitHub Actions the same table is also written to the job summary as Markdown.
 */
const fs = require('node:fs');

const COLORS = { passed: '\x1b[32m', failed: '\x1b[31m', skipped: '\x1b[33m', reset: '\x1b[0m', bold: '\x1b[1m' };
const LABEL = { passed: 'PASSED', failed: 'FAILED', pending: 'SKIPPED', skipped: 'SKIPPED', todo: 'TODO', disabled: 'SKIPPED' };

class TableReporter {
  onRunComplete(_contexts, results) {
    const rows = [];
    // Sort by file so the numbering is the same on every run (Jest finishes files in any order)
    const files = [...results.testResults].sort((a, b) => a.testFilePath.localeCompare(b.testFilePath));
    for (const file of files) {
      for (const t of file.testResults) {
        rows.push({ group: t.ancestorTitles.join(' > ') || '-', name: t.title, result: LABEL[t.status] ?? t.status.toUpperCase() });
      }
    }
    if (rows.length === 0) return;

    const head = { no: '#', group: 'Group', name: 'Case', result: 'Result' };
    const w = {
      no: Math.max(head.no.length, String(rows.length).length),
      group: Math.max(head.group.length, ...rows.map((r) => r.group.length)),
      name: Math.max(head.name.length, ...rows.map((r) => r.name.length)),
      result: Math.max(head.result.length, ...rows.map((r) => r.result.length)),
    };
    const line = (no, group, name, result) =>
      `| ${String(no).padEnd(w.no)} | ${group.padEnd(w.group)} | ${name.padEnd(w.name)} | ${result.padEnd(w.result)} |`;
    const color = (result, text) =>
      result === 'PASSED' ? COLORS.passed + text + COLORS.reset
        : result === 'FAILED' ? COLORS.failed + text + COLORS.reset
          : COLORS.skipped + text + COLORS.reset;

    const out = [];
    out.push('', `${COLORS.bold}${'='.repeat(30)} test cases ${'='.repeat(30)}${COLORS.reset}`, '');
    out.push(COLORS.bold + line(head.no, head.group, head.name, head.result) + COLORS.reset);
    out.push(`|${'-'.repeat(w.no + 2)}|${'-'.repeat(w.group + 2)}|${'-'.repeat(w.name + 2)}|${'-'.repeat(w.result + 2)}|`);
    rows.forEach((r, i) => out.push(color(r.result, line(i + 1, r.group, r.name, r.result))));

    const passed = rows.filter((r) => r.result === 'PASSED').length;
    const failed = rows.filter((r) => r.result === 'FAILED').length;
    const skipped = rows.length - passed - failed;
    const parts = [`${passed} passed`, failed && `${failed} failed`, skipped && `${skipped} skipped`].filter(Boolean);
    out.push(`${COLORS.bold}${failed ? COLORS.failed : COLORS.passed}TOTAL ${rows.length}: ${parts.join(', ')}${COLORS.reset}`, '');
    process.stdout.write(out.join('\n') + '\n');

    // GitHub Actions job summary (Markdown table, shown on the run page)
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) {
      const esc = (s) => s.replace(/\|/g, '\\|');
      const icon = { PASSED: '✅', FAILED: '❌' };
      const md = [
        '### Test cases',
        '',
        '| # | Group | Case | Result |',
        '|---|-------|------|--------|',
        ...rows.map((r, i) => `| ${i + 1} | ${esc(r.group)} | ${esc(r.name)} | ${icon[r.result] ?? '⏭️'} ${r.result} |`),
        '',
        `**TOTAL ${rows.length}: ${parts.join(', ')}**`,
        '',
      ];
      fs.appendFileSync(summary, md.join('\n') + '\n');
    }
  }
}

module.exports = TableReporter;
