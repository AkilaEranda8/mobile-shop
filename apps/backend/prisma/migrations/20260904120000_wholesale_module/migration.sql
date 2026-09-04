-- CreateEnum
CREATE TYPE "BranchKind" AS ENUM ('STORE', 'WAREHOUSE', 'VEHICLE');

-- CreateEnum
CREATE TYPE "WholesaleInvoiceChannel" AS ENUM ('COUNTER', 'VAN', 'DELIVERY');

-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DealerAddressType" AS ENUM ('BILL_TO', 'SHIP_TO');

-- CreateEnum
CREATE TYPE "WholesaleSellUnit" AS ENUM ('PIECE', 'BOX', 'CARTON');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "WholesaleSalesOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ON_HOLD', 'CONFIRMED', 'PARTIAL', 'FULFILLED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HoldType" AS ENUM ('CREDIT', 'MOQ', 'STOCK', 'MANUAL', 'PRICE');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WholesalePickStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WholesaleDispatchStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WholesaleTripStatus" AS ENUM ('PLANNED', 'LOADED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WholesaleStopStatus" AS ENUM ('PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "WholesaleInvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIAL', 'PAID', 'VOID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WholesaleCreditNoteStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "DealerPaymentStatus" AS ENUM ('COMPLETED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DealerCollectionTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WholesaleReturnStatus" AS ENUM ('DRAFT', 'RECEIVED', 'QC', 'CREDITED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WholesaleReturnDisposition" AS ENUM ('RESTOCK', 'DAMAGED', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "RepVisitStatus" AS ENUM ('PLANNED', 'CHECKED_IN', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VanLoadSheetStatus" AS ENUM ('DRAFT', 'LOADED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VanSettlementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'WHOLESALE_DISPATCH';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'WHOLESALE_RETURN';

-- AlterEnum
ALTER TYPE "CommissionSource" ADD VALUE IF NOT EXISTS 'WHOLESALE_VAN';

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "kind" "BranchKind" NOT NULL DEFAULT 'STORE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unitsPerBox" INTEGER,
ADD COLUMN     "unitsPerCarton" INTEGER;

-- AlterTable
ALTER TABLE "ImeiRecord" ADD COLUMN     "softReservedBy" TEXT,
ADD COLUMN     "softReservedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformActivityLog" ALTER COLUMN "target" SET DEFAULT '—',
ALTER COLUMN "ip" SET DEFAULT '—';

-- CreateTable
CREATE TABLE "DealerTier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dealer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "dealerCode" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "taxId" TEXT,
    "status" "DealerStatus" NOT NULL DEFAULT 'DRAFT',
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "cashOnly" BOOLEAN NOT NULL DEFAULT false,
    "assignedSalesRepId" TEXT,
    "tierId" TEXT,
    "totalDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerId" TEXT,
    "externalRef" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerAddress" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "type" "DealerAddressType" NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "postalCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesalePriceList" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "tierId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesalePriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesalePriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "floorPrice" DOUBLE PRECISION,
    "moq" INTEGER,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "sellUnit" "WholesaleSellUnit" NOT NULL DEFAULT 'PIECE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesalePriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleQtyBreak" (
    "id" TEXT NOT NULL,
    "priceListItemId" TEXT NOT NULL,
    "qtyFrom" INTEGER NOT NULL,
    "qtyTo" INTEGER,
    "unitPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WholesaleQtyBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleDealerPriceOverride" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "sellUnit" "WholesaleSellUnit",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleDealerPriceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleQuotation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "quoteNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "dealerId" TEXT NOT NULL,
    "validityEnd" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "convertedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleQuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "sellUnit" "WholesaleSellUnit" NOT NULL DEFAULT 'PIECE',
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "WholesaleQuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleSalesOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "status" "WholesaleSalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "dealerId" TEXT NOT NULL,
    "quotationId" TEXT,
    "requestedDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleSalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleSalesOrderLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "fulfilledQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellUnit" "WholesaleSellUnit" NOT NULL DEFAULT 'PIECE',
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "WholesaleSalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleOrderHold" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "type" "HoldType" NOT NULL,
    "reason" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WholesaleOrderHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "sku" TEXT,
    "imeiId" TEXT,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesalePickList" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "pickNumber" TEXT NOT NULL,
    "status" "WholesalePickStatus" NOT NULL DEFAULT 'DRAFT',
    "assignedPickerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesalePickList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesalePickLine" (
    "id" TEXT NOT NULL,
    "pickListId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pickedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WholesalePickLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleDispatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "pickListId" TEXT,
    "dispatchNumber" TEXT NOT NULL,
    "status" "WholesaleDispatchStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleDispatchLine" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WholesaleDispatchLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleDispatchSerial" (
    "id" TEXT NOT NULL,
    "dispatchLineId" TEXT NOT NULL,
    "imeiId" TEXT,
    "imei" TEXT NOT NULL,

    CONSTRAINT "WholesaleDispatchSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleDeliveryTrip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tripNumber" TEXT NOT NULL,
    "status" "WholesaleTripStatus" NOT NULL DEFAULT 'PLANNED',
    "vehicleId" TEXT,
    "driverUserId" TEXT,
    "plannedDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleDeliveryTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleDeliveryStop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "dispatchId" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" "WholesaleStopStatus" NOT NULL DEFAULT 'PENDING',
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WholesaleDeliveryStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleProofOfDelivery" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "acceptedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rejectedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signatureUrl" TEXT,
    "photoUrl" TEXT,
    "recipientName" TEXT,
    "notes" TEXT,
    "codCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WholesaleProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "WholesaleInvoiceChannel" NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "fulfillmentBranchId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "deliveryStopId" TEXT,
    "vehicleId" TEXT,
    "visitId" TEXT,
    "salesRepId" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "WholesaleInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "sourceNotes" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "sellUnit" "WholesaleSellUnit" NOT NULL DEFAULT 'PIECE',
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "imei" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WholesaleInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleInvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "WholesaleInvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "dealerId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "status" "DealerPaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "collectedById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerPaymentAllocation" (
    "id" TEXT NOT NULL,
    "dealerPaymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleCreditNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "creditNoteNumber" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "returnId" TEXT,
    "status" "WholesaleCreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleCreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WholesaleCreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerCollectionTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "dealerId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "status" "DealerCollectionTaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "targetAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerCollectionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleReturn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "WholesaleReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "disposition" "WholesaleReturnDisposition" NOT NULL DEFAULT 'RESTOCK',
    "imei" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WholesaleReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homeBranchId" TEXT NOT NULL,
    "stockBranchId" TEXT NOT NULL,
    "assignedRepUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "territoryId" TEXT,
    "defaultVehicleId" TEXT,
    "monthlyTarget" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRoute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "territoryId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRouteDealer" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesRouteDealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepVisit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "repUserId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "routeId" TEXT,
    "status" "RepVisitStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanLoadSheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "loadNumber" TEXT NOT NULL,
    "status" "VanLoadSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "loadedAt" TIMESTAMP(3),
    "notes" TEXT,
    "linesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VanLoadSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "repUserId" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "settlementDate" DATE NOT NULL,
    "status" "VanSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "declaredCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VanSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanSettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "openingQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loadedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "varianceQty" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "VanSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanSettlementPaymentBucket" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "VanSettlementPaymentBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealerTier_tenantId_isActive_idx" ON "DealerTier"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DealerTier_tenantId_name_key" ON "DealerTier"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Dealer_tenantId_status_idx" ON "Dealer"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Dealer_tenantId_isActive_idx" ON "Dealer"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Dealer_tenantId_assignedSalesRepId_idx" ON "Dealer"("tenantId", "assignedSalesRepId");

-- CreateIndex
CREATE INDEX "Dealer_tenantId_branchId_idx" ON "Dealer"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "Dealer_tierId_idx" ON "Dealer"("tierId");

-- CreateIndex
CREATE INDEX "Dealer_customerId_idx" ON "Dealer"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_tenantId_dealerCode_key" ON "Dealer"("tenantId", "dealerCode");

-- CreateIndex
CREATE INDEX "DealerAddress_dealerId_type_idx" ON "DealerAddress"("dealerId", "type");

-- CreateIndex
CREATE INDEX "WholesalePriceList_tenantId_isActive_idx" ON "WholesalePriceList"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "WholesalePriceList_tierId_idx" ON "WholesalePriceList"("tierId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesalePriceList_tenantId_name_key" ON "WholesalePriceList"("tenantId", "name");

-- CreateIndex
CREATE INDEX "WholesalePriceListItem_productId_idx" ON "WholesalePriceListItem"("productId");

-- CreateIndex
CREATE INDEX "WholesalePriceListItem_effectiveFrom_effectiveTo_idx" ON "WholesalePriceListItem"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "WholesalePriceListItem_priceListId_productId_sellUnit_key" ON "WholesalePriceListItem"("priceListId", "productId", "sellUnit");

-- CreateIndex
CREATE INDEX "WholesaleQtyBreak_priceListItemId_idx" ON "WholesaleQtyBreak"("priceListItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleQtyBreak_priceListItemId_qtyFrom_key" ON "WholesaleQtyBreak"("priceListItemId", "qtyFrom");

-- CreateIndex
CREATE INDEX "WholesaleDealerPriceOverride_productId_idx" ON "WholesaleDealerPriceOverride"("productId");

-- CreateIndex
CREATE INDEX "WholesaleDealerPriceOverride_effectiveFrom_effectiveTo_idx" ON "WholesaleDealerPriceOverride"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleDealerPriceOverride_dealerId_productId_sellUnit_key" ON "WholesaleDealerPriceOverride"("dealerId", "productId", "sellUnit");

-- CreateIndex
CREATE INDEX "WholesaleQuotation_tenantId_status_idx" ON "WholesaleQuotation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WholesaleQuotation_tenantId_dealerId_idx" ON "WholesaleQuotation"("tenantId", "dealerId");

-- CreateIndex
CREATE INDEX "WholesaleQuotation_validityEnd_idx" ON "WholesaleQuotation"("validityEnd");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleQuotation_tenantId_quoteNumber_version_key" ON "WholesaleQuotation"("tenantId", "quoteNumber", "version");

-- CreateIndex
CREATE INDEX "WholesaleQuotationLine_quotationId_idx" ON "WholesaleQuotationLine"("quotationId");

-- CreateIndex
CREATE INDEX "WholesaleQuotationLine_productId_idx" ON "WholesaleQuotationLine"("productId");

-- CreateIndex
CREATE INDEX "WholesaleSalesOrder_tenantId_status_idx" ON "WholesaleSalesOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WholesaleSalesOrder_tenantId_dealerId_idx" ON "WholesaleSalesOrder"("tenantId", "dealerId");

-- CreateIndex
CREATE INDEX "WholesaleSalesOrder_quotationId_idx" ON "WholesaleSalesOrder"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleSalesOrder_tenantId_orderNumber_key" ON "WholesaleSalesOrder"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "WholesaleSalesOrderLine_salesOrderId_idx" ON "WholesaleSalesOrderLine"("salesOrderId");

-- CreateIndex
CREATE INDEX "WholesaleSalesOrderLine_productId_idx" ON "WholesaleSalesOrderLine"("productId");

-- CreateIndex
CREATE INDEX "WholesaleOrderHold_salesOrderId_type_idx" ON "WholesaleOrderHold"("salesOrderId", "type");

-- CreateIndex
CREATE INDEX "StockReservation_tenantId_productId_branchId_status_idx" ON "StockReservation"("tenantId", "productId", "branchId", "status");

-- CreateIndex
CREATE INDEX "StockReservation_orderLineId_idx" ON "StockReservation"("orderLineId");

-- CreateIndex
CREATE INDEX "StockReservation_imeiId_idx" ON "StockReservation"("imeiId");

-- CreateIndex
CREATE INDEX "StockReservation_expiresAt_idx" ON "StockReservation"("expiresAt");

-- CreateIndex
CREATE INDEX "WholesalePickList_tenantId_status_idx" ON "WholesalePickList"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WholesalePickList_branchId_status_idx" ON "WholesalePickList"("branchId", "status");

-- CreateIndex
CREATE INDEX "WholesalePickList_salesOrderId_idx" ON "WholesalePickList"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesalePickList_tenantId_pickNumber_key" ON "WholesalePickList"("tenantId", "pickNumber");

-- CreateIndex
CREATE INDEX "WholesalePickLine_pickListId_idx" ON "WholesalePickLine"("pickListId");

-- CreateIndex
CREATE INDEX "WholesalePickLine_orderLineId_idx" ON "WholesalePickLine"("orderLineId");

-- CreateIndex
CREATE INDEX "WholesalePickLine_productId_idx" ON "WholesalePickLine"("productId");

-- CreateIndex
CREATE INDEX "WholesaleDispatch_tenantId_status_idx" ON "WholesaleDispatch"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WholesaleDispatch_salesOrderId_idx" ON "WholesaleDispatch"("salesOrderId");

-- CreateIndex
CREATE INDEX "WholesaleDispatch_pickListId_idx" ON "WholesaleDispatch"("pickListId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleDispatch_tenantId_dispatchNumber_key" ON "WholesaleDispatch"("tenantId", "dispatchNumber");

-- CreateIndex
CREATE INDEX "WholesaleDispatchLine_dispatchId_idx" ON "WholesaleDispatchLine"("dispatchId");

-- CreateIndex
CREATE INDEX "WholesaleDispatchLine_orderLineId_idx" ON "WholesaleDispatchLine"("orderLineId");

-- CreateIndex
CREATE INDEX "WholesaleDispatchLine_productId_idx" ON "WholesaleDispatchLine"("productId");

-- CreateIndex
CREATE INDEX "WholesaleDispatchSerial_dispatchLineId_idx" ON "WholesaleDispatchSerial"("dispatchLineId");

-- CreateIndex
CREATE INDEX "WholesaleDispatchSerial_imeiId_idx" ON "WholesaleDispatchSerial"("imeiId");

-- CreateIndex
CREATE INDEX "WholesaleDispatchSerial_imei_idx" ON "WholesaleDispatchSerial"("imei");

-- CreateIndex
CREATE INDEX "WholesaleDeliveryTrip_tenantId_status_idx" ON "WholesaleDeliveryTrip"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WholesaleDeliveryTrip_plannedDate_idx" ON "WholesaleDeliveryTrip"("plannedDate");

-- CreateIndex
CREATE INDEX "WholesaleDeliveryTrip_vehicleId_idx" ON "WholesaleDeliveryTrip"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleDeliveryTrip_tenantId_tripNumber_key" ON "WholesaleDeliveryTrip"("tenantId", "tripNumber");

-- CreateIndex
CREATE INDEX "WholesaleDeliveryStop_tripId_sequence_idx" ON "WholesaleDeliveryStop"("tripId", "sequence");

-- CreateIndex
CREATE INDEX "WholesaleDeliveryStop_dealerId_idx" ON "WholesaleDeliveryStop"("dealerId");

-- CreateIndex
CREATE INDEX "WholesaleDeliveryStop_salesOrderId_idx" ON "WholesaleDeliveryStop"("salesOrderId");

-- CreateIndex
CREATE INDEX "WholesaleDeliveryStop_dispatchId_idx" ON "WholesaleDeliveryStop"("dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleProofOfDelivery_stopId_key" ON "WholesaleProofOfDelivery"("stopId");

-- CreateIndex
CREATE INDEX "WholesaleInvoice_tenantId_channel_status_idx" ON "WholesaleInvoice"("tenantId", "channel", "status");

-- CreateIndex
CREATE INDEX "WholesaleInvoice_tenantId_dealerId_idx" ON "WholesaleInvoice"("tenantId", "dealerId");

-- CreateIndex
CREATE INDEX "WholesaleInvoice_tenantId_salesRepId_idx" ON "WholesaleInvoice"("tenantId", "salesRepId");

-- CreateIndex
CREATE INDEX "WholesaleInvoice_fulfillmentBranchId_idx" ON "WholesaleInvoice"("fulfillmentBranchId");

-- CreateIndex
CREATE INDEX "WholesaleInvoice_salesOrderId_idx" ON "WholesaleInvoice"("salesOrderId");

-- CreateIndex
CREATE INDEX "WholesaleInvoice_vehicleId_idx" ON "WholesaleInvoice"("vehicleId");

-- CreateIndex
CREATE INDEX "WholesaleInvoice_visitId_idx" ON "WholesaleInvoice"("visitId");

-- CreateIndex
CREATE INDEX "WholesaleInvoice_createdAt_idx" ON "WholesaleInvoice"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleInvoice_tenantId_invoiceNumber_key" ON "WholesaleInvoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "WholesaleInvoiceLine_invoiceId_idx" ON "WholesaleInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "WholesaleInvoiceLine_productId_idx" ON "WholesaleInvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "WholesaleInvoicePayment_invoiceId_idx" ON "WholesaleInvoicePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "DealerPayment_tenantId_dealerId_idx" ON "DealerPayment"("tenantId", "dealerId");

-- CreateIndex
CREATE INDEX "DealerPayment_tenantId_paidAt_idx" ON "DealerPayment"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "DealerPayment_status_idx" ON "DealerPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DealerPayment_tenantId_receiptNumber_key" ON "DealerPayment"("tenantId", "receiptNumber");

-- CreateIndex
CREATE INDEX "DealerPaymentAllocation_invoiceId_idx" ON "DealerPaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DealerPaymentAllocation_dealerPaymentId_invoiceId_key" ON "DealerPaymentAllocation"("dealerPaymentId", "invoiceId");

-- CreateIndex
CREATE INDEX "WholesaleCreditNote_tenantId_dealerId_idx" ON "WholesaleCreditNote"("tenantId", "dealerId");

-- CreateIndex
CREATE INDEX "WholesaleCreditNote_invoiceId_idx" ON "WholesaleCreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "WholesaleCreditNote_returnId_idx" ON "WholesaleCreditNote"("returnId");

-- CreateIndex
CREATE INDEX "WholesaleCreditNote_status_idx" ON "WholesaleCreditNote"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleCreditNote_tenantId_creditNoteNumber_key" ON "WholesaleCreditNote"("tenantId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "WholesaleCreditNoteLine_creditNoteId_idx" ON "WholesaleCreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE INDEX "WholesaleCreditNoteLine_productId_idx" ON "WholesaleCreditNoteLine"("productId");

-- CreateIndex
CREATE INDEX "DealerCollectionTask_tenantId_status_idx" ON "DealerCollectionTask"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DealerCollectionTask_tenantId_dealerId_idx" ON "DealerCollectionTask"("tenantId", "dealerId");

-- CreateIndex
CREATE INDEX "DealerCollectionTask_assigneeId_status_idx" ON "DealerCollectionTask"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "DealerCollectionTask_dueDate_idx" ON "DealerCollectionTask"("dueDate");

-- CreateIndex
CREATE INDEX "WholesaleReturn_tenantId_status_idx" ON "WholesaleReturn"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WholesaleReturn_tenantId_dealerId_idx" ON "WholesaleReturn"("tenantId", "dealerId");

-- CreateIndex
CREATE INDEX "WholesaleReturn_invoiceId_idx" ON "WholesaleReturn"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleReturn_tenantId_returnNumber_key" ON "WholesaleReturn"("tenantId", "returnNumber");

-- CreateIndex
CREATE INDEX "WholesaleReturnLine_returnId_idx" ON "WholesaleReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "WholesaleReturnLine_productId_idx" ON "WholesaleReturnLine"("productId");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_isActive_idx" ON "Vehicle"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Vehicle_assignedRepUserId_idx" ON "Vehicle"("assignedRepUserId");

-- CreateIndex
CREATE INDEX "Vehicle_stockBranchId_idx" ON "Vehicle"("stockBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_tenantId_plateNumber_key" ON "Vehicle"("tenantId", "plateNumber");

-- CreateIndex
CREATE INDEX "Territory_tenantId_isActive_idx" ON "Territory"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_tenantId_name_key" ON "Territory"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RepProfile_userId_key" ON "RepProfile"("userId");

-- CreateIndex
CREATE INDEX "RepProfile_tenantId_isActive_idx" ON "RepProfile"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "RepProfile_territoryId_idx" ON "RepProfile"("territoryId");

-- CreateIndex
CREATE INDEX "RepProfile_defaultVehicleId_idx" ON "RepProfile"("defaultVehicleId");

-- CreateIndex
CREATE INDEX "SalesRoute_tenantId_isActive_idx" ON "SalesRoute"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "SalesRoute_territoryId_idx" ON "SalesRoute"("territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesRoute_tenantId_name_key" ON "SalesRoute"("tenantId", "name");

-- CreateIndex
CREATE INDEX "SalesRouteDealer_dealerId_idx" ON "SalesRouteDealer"("dealerId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesRouteDealer_routeId_dealerId_key" ON "SalesRouteDealer"("routeId", "dealerId");

-- CreateIndex
CREATE INDEX "RepVisit_tenantId_status_idx" ON "RepVisit"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RepVisit_tenantId_repUserId_plannedAt_idx" ON "RepVisit"("tenantId", "repUserId", "plannedAt");

-- CreateIndex
CREATE INDEX "RepVisit_dealerId_idx" ON "RepVisit"("dealerId");

-- CreateIndex
CREATE INDEX "RepVisit_vehicleId_idx" ON "RepVisit"("vehicleId");

-- CreateIndex
CREATE INDEX "RepVisit_routeId_idx" ON "RepVisit"("routeId");

-- CreateIndex
CREATE INDEX "VanLoadSheet_tenantId_status_idx" ON "VanLoadSheet"("tenantId", "status");

-- CreateIndex
CREATE INDEX "VanLoadSheet_vehicleId_idx" ON "VanLoadSheet"("vehicleId");

-- CreateIndex
CREATE INDEX "VanLoadSheet_branchId_idx" ON "VanLoadSheet"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "VanLoadSheet_tenantId_loadNumber_key" ON "VanLoadSheet"("tenantId", "loadNumber");

-- CreateIndex
CREATE INDEX "VanSettlement_tenantId_settlementDate_idx" ON "VanSettlement"("tenantId", "settlementDate");

-- CreateIndex
CREATE INDEX "VanSettlement_tenantId_status_idx" ON "VanSettlement"("tenantId", "status");

-- CreateIndex
CREATE INDEX "VanSettlement_vehicleId_idx" ON "VanSettlement"("vehicleId");

-- CreateIndex
CREATE INDEX "VanSettlement_repUserId_idx" ON "VanSettlement"("repUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VanSettlement_tenantId_settlementNumber_key" ON "VanSettlement"("tenantId", "settlementNumber");

-- CreateIndex
CREATE INDEX "VanSettlementLine_settlementId_idx" ON "VanSettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "VanSettlementLine_productId_idx" ON "VanSettlementLine"("productId");

-- CreateIndex
CREATE INDEX "VanSettlementPaymentBucket_settlementId_idx" ON "VanSettlementPaymentBucket"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "VanSettlementPaymentBucket_settlementId_method_key" ON "VanSettlementPaymentBucket"("settlementId", "method");

-- CreateIndex
CREATE INDEX "Branch_tenantId_kind_idx" ON "Branch"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "ImeiRecord_softReservedUntil_idx" ON "ImeiRecord"("softReservedUntil");

-- AddForeignKey
ALTER TABLE "DealerTier" ADD CONSTRAINT "DealerTier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_assignedSalesRepId_fkey" FOREIGN KEY ("assignedSalesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "DealerTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerAddress" ADD CONSTRAINT "DealerAddress_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePriceList" ADD CONSTRAINT "WholesalePriceList_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePriceList" ADD CONSTRAINT "WholesalePriceList_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "DealerTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePriceListItem" ADD CONSTRAINT "WholesalePriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "WholesalePriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePriceListItem" ADD CONSTRAINT "WholesalePriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleQtyBreak" ADD CONSTRAINT "WholesaleQtyBreak_priceListItemId_fkey" FOREIGN KEY ("priceListItemId") REFERENCES "WholesalePriceListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDealerPriceOverride" ADD CONSTRAINT "WholesaleDealerPriceOverride_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDealerPriceOverride" ADD CONSTRAINT "WholesaleDealerPriceOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleQuotation" ADD CONSTRAINT "WholesaleQuotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleQuotation" ADD CONSTRAINT "WholesaleQuotation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleQuotation" ADD CONSTRAINT "WholesaleQuotation_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleQuotation" ADD CONSTRAINT "WholesaleQuotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleQuotationLine" ADD CONSTRAINT "WholesaleQuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "WholesaleQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleQuotationLine" ADD CONSTRAINT "WholesaleQuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleSalesOrder" ADD CONSTRAINT "WholesaleSalesOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleSalesOrder" ADD CONSTRAINT "WholesaleSalesOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleSalesOrder" ADD CONSTRAINT "WholesaleSalesOrder_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleSalesOrder" ADD CONSTRAINT "WholesaleSalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "WholesaleQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleSalesOrder" ADD CONSTRAINT "WholesaleSalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleSalesOrderLine" ADD CONSTRAINT "WholesaleSalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "WholesaleSalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleSalesOrderLine" ADD CONSTRAINT "WholesaleSalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleOrderHold" ADD CONSTRAINT "WholesaleOrderHold_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "WholesaleSalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "WholesaleSalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_imeiId_fkey" FOREIGN KEY ("imeiId") REFERENCES "ImeiRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePickList" ADD CONSTRAINT "WholesalePickList_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePickList" ADD CONSTRAINT "WholesalePickList_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePickList" ADD CONSTRAINT "WholesalePickList_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "WholesaleSalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePickList" ADD CONSTRAINT "WholesalePickList_assignedPickerId_fkey" FOREIGN KEY ("assignedPickerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePickLine" ADD CONSTRAINT "WholesalePickLine_pickListId_fkey" FOREIGN KEY ("pickListId") REFERENCES "WholesalePickList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePickLine" ADD CONSTRAINT "WholesalePickLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "WholesaleSalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesalePickLine" ADD CONSTRAINT "WholesalePickLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatch" ADD CONSTRAINT "WholesaleDispatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatch" ADD CONSTRAINT "WholesaleDispatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatch" ADD CONSTRAINT "WholesaleDispatch_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "WholesaleSalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatch" ADD CONSTRAINT "WholesaleDispatch_pickListId_fkey" FOREIGN KEY ("pickListId") REFERENCES "WholesalePickList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatchLine" ADD CONSTRAINT "WholesaleDispatchLine_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "WholesaleDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatchLine" ADD CONSTRAINT "WholesaleDispatchLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "WholesaleSalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatchLine" ADD CONSTRAINT "WholesaleDispatchLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatchSerial" ADD CONSTRAINT "WholesaleDispatchSerial_dispatchLineId_fkey" FOREIGN KEY ("dispatchLineId") REFERENCES "WholesaleDispatchLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDispatchSerial" ADD CONSTRAINT "WholesaleDispatchSerial_imeiId_fkey" FOREIGN KEY ("imeiId") REFERENCES "ImeiRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDeliveryTrip" ADD CONSTRAINT "WholesaleDeliveryTrip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDeliveryTrip" ADD CONSTRAINT "WholesaleDeliveryTrip_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDeliveryTrip" ADD CONSTRAINT "WholesaleDeliveryTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDeliveryTrip" ADD CONSTRAINT "WholesaleDeliveryTrip_driverUserId_fkey" FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDeliveryStop" ADD CONSTRAINT "WholesaleDeliveryStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "WholesaleDeliveryTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDeliveryStop" ADD CONSTRAINT "WholesaleDeliveryStop_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDeliveryStop" ADD CONSTRAINT "WholesaleDeliveryStop_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "WholesaleSalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleDeliveryStop" ADD CONSTRAINT "WholesaleDeliveryStop_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "WholesaleDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleProofOfDelivery" ADD CONSTRAINT "WholesaleProofOfDelivery_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "WholesaleDeliveryStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoice" ADD CONSTRAINT "WholesaleInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoice" ADD CONSTRAINT "WholesaleInvoice_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoice" ADD CONSTRAINT "WholesaleInvoice_fulfillmentBranchId_fkey" FOREIGN KEY ("fulfillmentBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoice" ADD CONSTRAINT "WholesaleInvoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "WholesaleSalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoice" ADD CONSTRAINT "WholesaleInvoice_deliveryStopId_fkey" FOREIGN KEY ("deliveryStopId") REFERENCES "WholesaleDeliveryStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoice" ADD CONSTRAINT "WholesaleInvoice_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoice" ADD CONSTRAINT "WholesaleInvoice_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "RepVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoice" ADD CONSTRAINT "WholesaleInvoice_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoiceLine" ADD CONSTRAINT "WholesaleInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "WholesaleInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoiceLine" ADD CONSTRAINT "WholesaleInvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleInvoicePayment" ADD CONSTRAINT "WholesaleInvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "WholesaleInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPayment" ADD CONSTRAINT "DealerPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPayment" ADD CONSTRAINT "DealerPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPayment" ADD CONSTRAINT "DealerPayment_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPayment" ADD CONSTRAINT "DealerPayment_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPaymentAllocation" ADD CONSTRAINT "DealerPaymentAllocation_dealerPaymentId_fkey" FOREIGN KEY ("dealerPaymentId") REFERENCES "DealerPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPaymentAllocation" ADD CONSTRAINT "DealerPaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "WholesaleInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleCreditNote" ADD CONSTRAINT "WholesaleCreditNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleCreditNote" ADD CONSTRAINT "WholesaleCreditNote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleCreditNote" ADD CONSTRAINT "WholesaleCreditNote_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleCreditNote" ADD CONSTRAINT "WholesaleCreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "WholesaleInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleCreditNote" ADD CONSTRAINT "WholesaleCreditNote_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "WholesaleReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleCreditNoteLine" ADD CONSTRAINT "WholesaleCreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "WholesaleCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleCreditNoteLine" ADD CONSTRAINT "WholesaleCreditNoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerCollectionTask" ADD CONSTRAINT "DealerCollectionTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerCollectionTask" ADD CONSTRAINT "DealerCollectionTask_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerCollectionTask" ADD CONSTRAINT "DealerCollectionTask_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerCollectionTask" ADD CONSTRAINT "DealerCollectionTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleReturn" ADD CONSTRAINT "WholesaleReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleReturn" ADD CONSTRAINT "WholesaleReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleReturn" ADD CONSTRAINT "WholesaleReturn_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleReturn" ADD CONSTRAINT "WholesaleReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "WholesaleInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleReturnLine" ADD CONSTRAINT "WholesaleReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "WholesaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleReturnLine" ADD CONSTRAINT "WholesaleReturnLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_homeBranchId_fkey" FOREIGN KEY ("homeBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_stockBranchId_fkey" FOREIGN KEY ("stockBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_assignedRepUserId_fkey" FOREIGN KEY ("assignedRepUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepProfile" ADD CONSTRAINT "RepProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepProfile" ADD CONSTRAINT "RepProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepProfile" ADD CONSTRAINT "RepProfile_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepProfile" ADD CONSTRAINT "RepProfile_defaultVehicleId_fkey" FOREIGN KEY ("defaultVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRoute" ADD CONSTRAINT "SalesRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRoute" ADD CONSTRAINT "SalesRoute_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRouteDealer" ADD CONSTRAINT "SalesRouteDealer_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "SalesRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRouteDealer" ADD CONSTRAINT "SalesRouteDealer_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_repUserId_fkey" FOREIGN KEY ("repUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "SalesRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanLoadSheet" ADD CONSTRAINT "VanLoadSheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanLoadSheet" ADD CONSTRAINT "VanLoadSheet_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanLoadSheet" ADD CONSTRAINT "VanLoadSheet_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanSettlement" ADD CONSTRAINT "VanSettlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanSettlement" ADD CONSTRAINT "VanSettlement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanSettlement" ADD CONSTRAINT "VanSettlement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanSettlement" ADD CONSTRAINT "VanSettlement_repUserId_fkey" FOREIGN KEY ("repUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanSettlementLine" ADD CONSTRAINT "VanSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "VanSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanSettlementLine" ADD CONSTRAINT "VanSettlementLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanSettlementPaymentBucket" ADD CONSTRAINT "VanSettlementPaymentBucket_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "VanSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
