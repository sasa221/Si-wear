import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AnimatePresence } from "framer-motion";

import HomePage from "@/pages/HomePage";
import ShopPage from "@/pages/ShopPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CustomDesignPage from "@/pages/CustomDesignPage";
import SizeChartPage from "@/pages/SizeChartPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import ShippingReturnsPage from "@/pages/ShippingReturnsPage";
import OrderSuccessPage from "@/pages/OrderSuccessPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ProfilePage from "@/pages/ProfilePage";
import MyOrdersPage from "@/pages/MyOrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminOrdersPage from "@/pages/admin/AdminOrdersPage";
import AdminProductsPage from "@/pages/admin/AdminProductsPage";
import AdminInventoryPage from "@/pages/admin/AdminInventoryPage";
import ProductFormPage from "@/pages/admin/ProductFormPage";
import AdminCategoriesPage from "@/pages/admin/AdminCategoriesPage";
import AdminDiscountCodesPage from "@/pages/admin/AdminDiscountCodesPage";
import AdminShippingPage from "@/pages/admin/AdminShippingPage";
import AdminReturnRequestsPage from "@/pages/admin/AdminReturnRequestsPage";
import AdminOrderPrintPage from "@/pages/admin/AdminOrderPrintPage";
import AdminMessagesPage from "@/pages/admin/AdminMessagesPage";
import AdminMessageDetailPage from "@/pages/admin/AdminMessageDetailPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import {
  PrivacyPolicyPage,
  ReturnsExchangePolicyPage,
  ShippingPolicyPage,
  TermsConditionsPage,
} from "@/pages/PolicyPages";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppRouter() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith("/admin");

  if (isAdminRoute) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground">
      <Header />
      <main className="flex-1">
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
      </main>
      <Footer />
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
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
