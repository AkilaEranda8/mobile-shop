-- Payment Fees & Clearance release note v2.20.0 (idempotent)
DO $$
DECLARE
  rid TEXT;
BEGIN
  SELECT id INTO rid FROM "Release" WHERE version = '2.20.0' LIMIT 1;
  IF rid IS NULL THEN
    rid := 'cmpayfeeclr2200release01';
    INSERT INTO "Release" (
      id, version, title, summary, "releaseDate", status, "popupEnabled", active,
      "targetType", "targetPlans", "targetTenants", "targetBranches",
      "createdBy", "createdAt", "updatedAt"
    ) VALUES (
      rid,
      '2.20.0',
      '27 September 2026 — Payment Fees & Clearance',
      'Charge a customer fee on any payment method (Koko, card, etc.), track provider payments until they reach your bank, and Mark as Clear with the provider deduction. Optional — existing payment methods work exactly as before.',
      '2026-09-27 00:00:00',
      'PUBLISHED',
      true,
      true,
      'ALL',
      '{}',
      '{}',
      '{}',
      'Admin',
      NOW(),
      NOW()
    );

    INSERT INTO "ReleaseItem" (id, "releaseId", category, module, "featureName", description, badge, "displayOrder") VALUES
      ('cmpayfeeclr2200item0001', rid, 'NEW_FEATURE', 'Settings', 'Payment method fee & clearance options',
       'Settings → Payments → each method has "Fee & clearance options": show/hide at checkout, customer fee (% or fixed), and "Needs clearance" for providers like Koko, card or cheque. Cash never has a fee.',
       'NEW', 0),
      ('cmpayfeeclr2200item0002', rid, 'NEW_FEATURE', 'POS', 'Customer payment fee at checkout',
       'When a method has a fee, POS shows the fee and "Customer pays" total before completing the sale. The fee is printed on the receipt / invoice and saved with the sale — old sales are never changed.',
       'NEW', 1),
      ('cmpayfeeclr2200item0003', rid, 'NEW_FEATURE', 'Sales', 'Awaiting clearance & Mark as Clear',
       'Sales paid by a clearance method show "Awaiting clearance" with a new filter and total card. When the provider pays you, open the sale → Mark as Clear, enter the provider deduction and choose the bank or cash account. Owner / Manager only; reversal needs the admin password.',
       'NEW', 2),
      ('cmpayfeeclr2200item0004', rid, 'NEW_FEATURE', 'Accounting', 'Automatic clearing account per method',
       'Turning on clearance creates a clearing account for that method (e.g. "Koko Clearing"). It appears in Cash & Bank → Clearing accounts with the pending count; Settle opens the pending payments list to clear one by one.',
       'NEW', 3),
      ('cmpayfeeclr2200item0005', rid, 'IMPROVEMENT', 'Accounting', 'Fee income & provider charges in the GL',
       'Customer fees post to "Payment Surcharge Income" and provider deductions to "Payment Provider Charges". Money stays in the clearing account until cleared — it never reaches Main Cash / Bank early.',
       'IMPROVED', 4),
      ('cmpayfeeclr2200item0006', rid, 'BUG_FIX', 'Sales', 'Safer returns and edits for provider payments',
       'Payments with a fee or pending clearance cannot be changed by invoice edit, and refunds through a provider that has not paid yet are blocked (refund as cash or store credit instead) to keep clearing balances correct.',
       'FIXED', 5),
      ('cmpayfeeclr2200item0007', rid, 'SECURITY', 'Platform', 'Security updates',
       'Framework security patches and stricter spreadsheet upload checks.',
       'SECURITY', 6);
  ELSE
    UPDATE "Release"
    SET status = 'PUBLISHED', "popupEnabled" = true, active = true, "updatedAt" = NOW()
    WHERE id = rid;
  END IF;
END $$;
