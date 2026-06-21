import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import adminRouter from "./admin";
import authRouter from "./auth";
import storageRouter from "./storage";
import productsRouter from "./products";
import usersRouter from "./users";
import settingsRouter from "./settings";
import shippingRouter from "./shipping";
import discountCodesRouter from "./discountCodes";
import adminOrdersRouter from "./adminOrders";
import messagesRouter from "./messages";
import returnsRouter from "./returns";
import categoriesRouter from "./categories";

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
