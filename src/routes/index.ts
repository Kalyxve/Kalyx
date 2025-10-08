import { Router } from 'express';
import authRoutes from './auth';
import categoryRoutes from './category';
import clientRoutes from './client';
import supplierRoutes from './supplier';
import userRoutes from './user';
import productRoutes from './product';
import rateRoutes from './rates';
import saleRoutes from './sale';
import purchaseRoutes from './purchase';
import inventoryRoutes from './inventory'; // 👈 NEW

const router = Router();

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/clients', clientRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/rates', rateRoutes);
router.use('/sales', saleRoutes);
router.use('/purchases', purchaseRoutes); // 👈 NEW
router.use('/inventory', inventoryRoutes);

export default router;
