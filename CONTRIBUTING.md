# Contributing

Thanks for helping improve Pixel Art.

## Development principles

- Keep rendering, document state, tools, file formats and UI code separated.
- Prefer real, testable functionality over placeholder controls.
- Preserve existing working behavior when changing modules.
- Keep image processing local to the browser.
- Keep the static build compatible with GitHub Pages.
- Document limitations and format changes, especially when importing/exporting PSD.

## Workflow

1. Open an issue describing the bug or proposed feature.
2. Create a focused branch.
3. Run `npm install` and `npm run dev`.
4. Run `npm test`, `npx playwright install chromium`, and `npm run test:e2e`.
5. Run `npm run build` and manually test the affected workflow in a modern browser.
6. Submit a pull request with reproduction steps and screenshots where useful.

## Code style

Use ES modules, descriptive names, small functions and browser-native APIs where practical. Keep third-party dependencies justified and document browser compatibility or format limitations.
