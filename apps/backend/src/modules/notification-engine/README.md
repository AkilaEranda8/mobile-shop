# Notification Engine (Phase 1)

Central dispatch for channel adapters: WhatsApp + in-app (`UserNotification`).

**Writes:** channel-specific only (WhatsApp send / UserNotification create)  
**Flag:** none — facade over existing adapters  
**Blueprint:** Section 4.3.10  
**Must not:** template UI; domain mutations beyond notification logs

## Entrypoints

| Function | Use |
|----------|-----|
| `dispatchNotification(input)` | Multi-channel dispatch |
| `notifyDeliveryDispatched` | Delivery tracking WhatsApp |
| `notifySaleInvoice` | Sale / billing WhatsApp invoice |
| `dispatchInAppNotification` | In-app bell notifications |

## Consumers

- `delivery.service.ts` — tracking WhatsApp
- `feature-suggestions.repository` — in-app suggestion updates
- `whatsapp.controller` / `admin.routes` — sale invoice send

## Channels

- `whatsapp` → `whatsappService`
- `in_app` → `UserNotification`
