import { SUPPORT_EMAIL, WHATSAPP_NUMBER } from './data'

export function buildWhatsAppRequestMessage(serviceName: string, packageName: string, packagePrice: string) {
  return [
    'Hello Hexalyte Innovation,',
    '',
    'I would like to request the following service.',
    '',
    `Service:`,
    serviceName,
    '',
    `Package:`,
    packageName,
    '',
    `Price:`,
    packagePrice,
    '',
    'Name:',
    '',
    'Company:',
    '',
    'Phone:',
    '',
    'Please contact me with more details.',
    '',
    'Thank you.',
  ].join('\n')
}

export function getWhatsAppRequestUrl(serviceName: string, packageName: string, packagePrice: string) {
  const text = buildWhatsAppRequestMessage(serviceName, packageName, packagePrice)
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}

export function getWhatsAppContactUrl(message = 'Hello Hexalyte Innovation, I need help with Business Services.') {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export { SUPPORT_EMAIL, WHATSAPP_NUMBER }
