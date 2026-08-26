-- HR Phase 4–7: Salary, Commission, Payroll, Advances/Loans

CREATE TYPE "SalaryComponentKind" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER');
CREATE TYPE "SalaryCalcType" AS ENUM ('FIXED', 'PERCENT_OF_BASIC');
CREATE TYPE "CommissionSource" AS ENUM ('SALES', 'REPAIRS', 'HIRE_PURCHASE');
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'PROCESSING', 'REVIEW', 'APPROVED', 'PAID', 'CANCELLED');
CREATE TYPE "PayrollLineKind" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER');
CREATE TYPE "EmployeeAdvanceStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'DISBURSED', 'RECOVERED', 'CANCELLED');
CREATE TYPE "EmployeeLoanStatus" AS ENUM ('REQUESTED', 'APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED', 'CANCELLED');
CREATE TYPE "LoanInstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'SKIPPED');

CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "SalaryComponentKind" NOT NULL DEFAULT 'EARNING',
    "calcType" "SalaryCalcType" NOT NULL DEFAULT 'FIXED',
    "defaultAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeSalary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeSalaryLine" (
    "id" TEXT NOT NULL,
    "employeeSalaryId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalaryLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "source" "CommissionSource" NOT NULL,
    "ratePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flatPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "branchId" TEXT,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "inputSnapshot" JSONB,
    "resultSnapshot" JSONB,
    "deterministicHash" TEXT,
    "accountingRunId" TEXT,
    "processedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "approvedByEmail" TEXT,
    "paidByEmail" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "PayrollLineKind" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "gross" DOUBLE PRECISION NOT NULL,
    "deductions" DOUBLE PRECISION NOT NULL,
    "net" DOUBLE PRECISION NOT NULL,
    "linesJson" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeAdvance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "EmployeeAdvanceStatus" NOT NULL DEFAULT 'REQUESTED',
    "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewerNote" TEXT,
    "reviewedByEmail" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAdvance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeLoan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT,
    "principal" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installmentCount" INTEGER NOT NULL,
    "installmentAmount" DOUBLE PRECISION NOT NULL,
    "outstanding" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "EmployeeLoanStatus" NOT NULL DEFAULT 'REQUESTED',
    "reviewerNote" TEXT,
    "reviewedByEmail" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "LoanInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalaryComponent_tenantId_code_key" ON "SalaryComponent"("tenantId", "code");
CREATE UNIQUE INDEX "SalaryComponent_tenantId_name_key" ON "SalaryComponent"("tenantId", "name");
CREATE INDEX "SalaryComponent_tenantId_isActive_idx" ON "SalaryComponent"("tenantId", "isActive");

CREATE INDEX "EmployeeSalary_tenantId_employeeId_effectiveFrom_idx" ON "EmployeeSalary"("tenantId", "employeeId", "effectiveFrom");
CREATE INDEX "EmployeeSalary_employeeId_effectiveFrom_idx" ON "EmployeeSalary"("employeeId", "effectiveFrom");

CREATE UNIQUE INDEX "EmployeeSalaryLine_employeeSalaryId_componentId_key" ON "EmployeeSalaryLine"("employeeSalaryId", "componentId");
CREATE INDEX "EmployeeSalaryLine_componentId_idx" ON "EmployeeSalaryLine"("componentId");

CREATE UNIQUE INDEX "CommissionRule_tenantId_name_key" ON "CommissionRule"("tenantId", "name");
CREATE INDEX "CommissionRule_tenantId_source_isActive_idx" ON "CommissionRule"("tenantId", "source", "isActive");

CREATE UNIQUE INDEX "PayrollPeriod_tenantId_label_key" ON "PayrollPeriod"("tenantId", "label");
CREATE INDEX "PayrollPeriod_tenantId_year_month_idx" ON "PayrollPeriod"("tenantId", "year", "month");
CREATE INDEX "PayrollPeriod_tenantId_status_idx" ON "PayrollPeriod"("tenantId", "status");

CREATE INDEX "PayrollRun_tenantId_status_idx" ON "PayrollRun"("tenantId", "status");
CREATE INDEX "PayrollRun_tenantId_periodId_idx" ON "PayrollRun"("tenantId", "periodId");
CREATE INDEX "PayrollRun_branchId_idx" ON "PayrollRun"("branchId");

CREATE INDEX "PayrollLine_runId_employeeId_idx" ON "PayrollLine"("runId", "employeeId");
CREATE INDEX "PayrollLine_employeeId_idx" ON "PayrollLine"("employeeId");

CREATE UNIQUE INDEX "Payslip_runId_employeeId_key" ON "Payslip"("runId", "employeeId");
CREATE INDEX "Payslip_tenantId_employeeId_issuedAt_idx" ON "Payslip"("tenantId", "employeeId", "issuedAt");

CREATE INDEX "EmployeeAdvance_tenantId_status_idx" ON "EmployeeAdvance"("tenantId", "status");
CREATE INDEX "EmployeeAdvance_tenantId_employeeId_idx" ON "EmployeeAdvance"("tenantId", "employeeId");

CREATE INDEX "EmployeeLoan_tenantId_status_idx" ON "EmployeeLoan"("tenantId", "status");
CREATE INDEX "EmployeeLoan_tenantId_employeeId_idx" ON "EmployeeLoan"("tenantId", "employeeId");

CREATE UNIQUE INDEX "LoanInstallment_loanId_seq_key" ON "LoanInstallment"("loanId", "seq");
CREATE INDEX "LoanInstallment_loanId_status_idx" ON "LoanInstallment"("loanId", "status");
CREATE INDEX "LoanInstallment_dueDate_status_idx" ON "LoanInstallment"("dueDate", "status");

ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryLine" ADD CONSTRAINT "EmployeeSalaryLine_employeeSalaryId_fkey" FOREIGN KEY ("employeeSalaryId") REFERENCES "EmployeeSalary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryLine" ADD CONSTRAINT "EmployeeSalaryLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "EmployeeLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
