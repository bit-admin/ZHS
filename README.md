# ZHS Autovisor Electron

Electron port of the Python Autovisor (CXRunfree/Autovisor) reference implementation.

Be patient as the website may be very slow.

## Development

```bash
npm install
npm run dev
```

The app opens a native left task panel and a right `WebContentsView` browser. The website session uses the persistent `persist:zhs` partition, so Zhihuishu cookies survive restarts.

## Verification

```bash
npm run typecheck
npm run build
npm run build:mac
npm run build:win
```
