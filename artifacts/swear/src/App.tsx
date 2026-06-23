import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AnimatePresence } from "framer-motion";
import { Analytics } from "@vercel/analytics/react";

const Header = lazy(() => import("@/components/layout/Header").then(module => ({ default: module.Header })));
const Footer = lazy(() => import("@/components/layout/Footer").then(module => ({ default: module.Footer })));

const HomePage = lazy(() => import("@/pages/HomePage"));
const ShopPage = lazy(() => import("@/pages/ShopPage"));
const ProductDetailPage = lazy(() => import("@/pages/ProductDetailPage"));
const CartPage = lazy(() => import("@/pages/CartPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const CustomDesignPage = lazy(() => import("@/pages/CustomDesignPage"));
const SizeChartPage = lazy(() => import("@/pages/SizeChartPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const ShippingReturnsPage = lazy(() => import("@/pages/ShippingReturnsPage"));
const OrderSuccessPage = lazy(() => import("@/pages/OrderSuccessPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const MyOrdersPage = lazy(() => import("@/pages/MyOrdersPage"));
const OrderDetailPage = lazy(() => import("@/pages/OrderDetailPage"));
const NotFound = lazy(() => import("@/pages/not-found"));

const AdminLoginPage = lazy(() => import("@/pages/admin/AdminLoginPage"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminOrdersPage = lazy(() => import("@/pages/admin/AdminOrdersPage"));
const AdminProductsPage = lazy(() => import("@/pages/admin/AdminProductsPage"));
const AdminInventoryPage = lazy(() => import("@/pages/admin/AdminInventoryPage"));
const ProductFormPage = lazy(() => import("@/pages/admin/ProductFormPage"));
const AdminCategoriesPage = lazy(() => import("@/pages/admin/AdminCategoriesPage"));
const AdminDiscountCodesPage = lazy(() => import("@/pages/admin/AdminDiscountCodesPage"));
const AdminShippingPage = lazy(() => import("@/pages/admin/AdminShippingPage"));
const AdminReturnRequestsPage = lazy(() => import("@/pages/admin/AdminReturnRequestsPage"));
const AdminOrderPrintPage = lazy(() => import("@/pages/admin/AdminOrderPrintPage"));
const AdminMessagesPage = lazy(() => import("@/pages/admin/AdminMessagesPage"));
const AdminMessageDetailPage = lazy(() => import("@/pages/admin/AdminMessageDetailPage"));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsersPage"));
const AdminSettingsPage = lazy(() => import("@/pages/admin/AdminSettingsPage"));

const PrivacyPolicyPage = lazy(() =>
  import("@/pages/PolicyPages").then(module => ({ default: module.PrivacyPolicyPage }))
);
const ReturnsExchangePolicyPage = lazy(() =>
  import("@/pages/PolicyPages").then(module => ({ default: module.ReturnsExchangePolicyPage }))
);
const ShippingPolicyPage = lazy(() =>
  import("@/pages/PolicyPages").then(module => ({ default: module.ShippingPolicyPage }))
);
const TermsConditionsPage = lazy(() =>
  import("@/pages/PolicyPages").then(module => ({ default: module.TermsConditionsPage }))
);

const queryClient = new QueryClient();

function RouteFallback({ admin = false }: { admin?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${admin ? "min-h-screen bg-background" : "min-h-[50vh]"}`}>
      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Loading...</span>
    </div>
  );
}

function HeaderFallback() {
  return <div className="h-[84px] md:h-[92px] border-b border-border bg-background" />;
}

function AppRouter() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith("/admin");

  if (isAdminRoute) {
    return (
      <Suspense fallback={<RouteFallback admin />}>
        <AnimatePresence mode="wait">
          <Switch>
            <Route path="/admin/login" component={AdminLoginPage} />
            <Route path="/admin" component={AdminDashboard} />
            <Route path="/admin/orders/:id/print" component={AdminOrderPrintPage} />
            <Route path="/admin/orders" component={AdminOrdersPage} />
            <Route path="/admin/messages/:id" component={AdminMessageDetailPage} />
            <Route path="/admin/messages" component={AdminMessagesPage} />
            <Route path="/admin/users" component={AdminUsersPage} />
            <Route path="/admin/products" component={AdminProductsPage} />
            <Route path="/admin/inventory" component={AdminInventoryPage} />
            <Route path="/admin/products/new" component={ProductFormPage} />
            <Route path="/admin/products/:id/edit" component={ProductFormPage} />
            <Route path="/admin/categories" component={AdminCategoriesPage} />
            <Route path="/admin/discount-codes" component={AdminDiscountCodesPage} />
            <Route path="/admin/shipping" component={AdminShippingPage} />
            <Route path="/admin/returns" component={AdminReturnRequestsPage} />
            <Route path="/admin/settings" component={AdminSettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </AnimatePresence>
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground">
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <AnimatePresence mode="wait">
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/login" component={LoginPage} />
              <Route path="/signup" component={SignupPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/my-orders" component={MyOrdersPage} />
              <Route path="/order/:id" component={OrderDetailPage} />
              <Route path="/orders/:id" component={OrderDetailPage} />
              <Route path="/shop" component={ShopPage} />
              <Route path="/shop/:id" component={ProductDetailPage} />
              <Route path="/cart" component={CartPage} />
              <Route path="/checkout" component={CheckoutPage} />
              <Route path="/custom-design" component={CustomDesignPage} />
              <Route path="/size-chart" component={SizeChartPage} />
              <Route path="/about" component={AboutPage} />
              <Route path="/contact" component={ContactPage} />
              <Route path="/shipping-returns" component={ShippingReturnsPage} />
              <Route path="/shipping-policy" component={ShippingPolicyPage} />
              <Route path="/returns-exchange-policy" component={ReturnsExchangePolicyPage} />
              <Route path="/privacy-policy" component={PrivacyPolicyPage} />
              <Route path="/terms-conditions" component={TermsConditionsPage} />
              <Route path="/order-success" component={OrderSuccessPage} />
              <Route component={NotFound} />
            </Switch>
          </AnimatePresence>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CartProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ScrollToTop />
              <AppRouter />
            </WouterRouter>
            <Toaster />
            <Analytics />
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
