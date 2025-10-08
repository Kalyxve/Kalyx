"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const category_1 = __importDefault(require("./category"));
const client_1 = __importDefault(require("./client"));
const supplier_1 = __importDefault(require("./supplier"));
const user_1 = __importDefault(require("./user"));
const product_1 = __importDefault(require("./product"));
const rates_1 = __importDefault(require("./rates"));
const sale_1 = __importDefault(require("./sale"));
const purchase_1 = __importDefault(require("./purchase"));
const inventory_1 = __importDefault(require("./inventory")); // 👈 NEW
const router = (0, express_1.Router)();
router.use('/auth', auth_1.default);
router.use('/categories', category_1.default);
router.use('/clients', client_1.default);
router.use('/suppliers', supplier_1.default);
router.use('/users', user_1.default);
router.use('/products', product_1.default);
router.use('/rates', rates_1.default);
router.use('/sales', sale_1.default);
router.use('/purchases', purchase_1.default); // 👈 NEW
router.use('/inventory', inventory_1.default);
exports.default = router;
