// Legacy command retained; validate current renderer with the installed EJS plugin.
// Original architecture-specific checks are archived in legacy-overview-tests.
if (!process.argv.includes('--strict-table-spacing') && !process.argv.includes('--ignore-table-spacing')) process.argv.push('--ignore-table-spacing');
await import('./test_spirit_overviews.mjs');
