# helpbuy-calculator - agent guide

Independent, no-signup planner for the Australian Government Help to Buy
Scheme. Vite + React + TypeScript.

## Commands

```powershell
npm run dev      # local dev
npm run build    # production build
npm run test     # test suite
npm run preview  # preview the build
```

## Rules

- The calculator is a financial tool. Do not change a formula without a test and
  a clear note on the source of the rule.
- Keep the no-signup, no-tracking promise. Do not add analytics or an account
  gate.
- State assumptions on screen; do not hide them in a tooltip.
- Manual gate: tests passing, build clean.

Global rules: `C:\Users\Deej\AGENTS.md`.
