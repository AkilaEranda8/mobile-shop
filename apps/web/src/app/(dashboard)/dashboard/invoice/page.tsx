import InvoicePrint, { SAMPLE_INVOICE } from '@/components/invoice/InvoicePrint'

export default function InvoicePage() {
  return <InvoicePrint data={SAMPLE_INVOICE} />
}
