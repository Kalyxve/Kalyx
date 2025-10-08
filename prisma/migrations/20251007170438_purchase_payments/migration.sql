-- AlterTable
ALTER TABLE `purchase` ADD COLUMN `paidBs` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `paidUsd` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `PurchasePayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseId` INTEGER NOT NULL,
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

-- AddForeignKey
ALTER TABLE `PurchasePayment` ADD CONSTRAINT `PurchasePayment_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `Purchase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
