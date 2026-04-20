# Doora — Bluetooth door manager

Doora connects to a Shelly switch device with enabled Bluetooth and calls a toggle action.
Installable as a PWA — works offline after the first visit.

## Ready to use
 [https://aplikace.sdileni.online/doora](https://aplikace.sdileni.online/doora)

## Usage

1. Enter the Shelly device password (if set) and tap **Open**.
2. Select your Shelly device from the Bluetooth picker.
3. The switch is toggled.

## Shelly configuration tips

- For **Step-Stop-Step gates** add `Automatic Off delay: 1s` in the Shelly switch settings.
- **Password protection** is configured under Shelly Settings → Authorization (currently visible only in the Shelly web administration).

## Development

```bash
npm install
npm run build   # output goes to dist/
```

## PWA install

Open the app over HTTPS and use **Add to Home Screen** (Android: Chrome menu, iOS: Share → Add to Home Screen).
