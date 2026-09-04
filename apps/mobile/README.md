# Hexalyte Rep (Flutter)

Field sales app for wholesale **van / rep** workflows. Talks to the same Hexalyte backend as the web `/rep` PWA.

## Features (v1)

- Login (email + password + shop slug)
- Vehicle select
- Dealer list / search
- Check-in visit
- Quick van sale (product id + qty + price + cash)
- Collect dealer payment
- Offline queue (sale / payment / visit) with sync badge

## Setup

```bash
cd apps/mobile
flutter pub get
```

### API URL

| Where you run | `API_BASE_URL` |
|---------------|----------------|
| Android emulator | `http://10.0.2.2:3001/api/v1` (default) |
| iOS simulator | `http://localhost:3001/api/v1` |
| Physical phone | `http://<your-pc-lan-ip>:3001/api/v1` |

```bash
# Android emulator (default)
flutter run

# iOS simulator
flutter run --dart-define=API_BASE_URL=http://localhost:3001/api/v1

# Device on LAN
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3001/api/v1
```

You can also change the API URL on the login screen under **API settings**.

## Backend requirements

1. Apply Prisma migrations (`WHOLESALE` module + journal enum).
2. Enable tenant features **WHOLESALE** and **REP_VAN_SALES**.
3. Create dealers + at least one vehicle in web Wholesale.
4. User needs `REP_VAN_*` permissions.

## Project layout

```
lib/
  main.dart
  core/          # config, auth, HTTP client
  data/          # wholesale API
  offline/       # local queue
  ui/            # login + home + dealer sheet
```

## Not in v1 (next)

- Barcode / IMEI scanner
- Product catalog picker (ATP from vehicle branch)
- Settlement wizard
- Push notifications
- Full Hexalyte branding assets
