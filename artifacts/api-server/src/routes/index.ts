import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import ordersRouter from "./orders.js";
import adminRouter from "./admin.js";
import authRouter from "./auth.js";
import storageRouter from "./storage.js";
import productsRouter from "./products.js";
import usersRouter from "./users.js";
import settingsRouter from "./settings.js";
import shippingRouter from "./shipping.js";
import discountCodesRouter from "./discountCodes.js";
import adminOrdersRouter from "./adminOrders.js";
import messagesRouter from "./messages.js";
import returnsRouter from "./returns.js";
import categoriesRouter from "./categories.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(productsRouter);
router.use(usersRouter);
router.use(settingsRouter);
router.use(shippingRouter);
router.use(discountCodesRouter);
router.use(adminOrdersRouter);
router.use(messagesRouter);
router.use(returnsRouter);
router.use(categoriesRouter);
router.use(ordersRouter);
router.use(adminRouter);

export default router;
