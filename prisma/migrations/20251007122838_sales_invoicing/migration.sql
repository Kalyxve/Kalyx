/*
  Warnings:

  - A unique constraint covering the columns `[invoiceNumber]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invoiceNumber` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `sale` ADD COLUMN `invoiceNumber` VARCHAR(191) NOT NULL,
    ADD COLUMN `paidBs` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `paidUsd` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `status` ENUM('OPEN', 'PARTIAL', 'PAID', 'VOID') NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE `SalePayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `method` ENUM('CASH_BS', 'CASH_USD', 'DEBIT_CARD', 'PAGO_MOVIL', 'TRANSFER_BS', 'TRANSFER_USD') NOT NULL,
    `currency` ENUM('USD', 'BS') NOT NULL,
    `rate` DECIMAL(12, 6) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `amountBs` DECIMAL(12, 2) NOT NULL,
    `amountUsd` DECIMAL(12, 2) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Sale_invoiceNumber_key` ON `Sale`(`invoiceNumber`);

-- AddForeignKey
ALTER TABLE `SalePayment` ADD CONSTRAINT `SalePayment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
