import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Menu, X, LayoutDashboard, ShoppingBag, Package, LogOut, Store, Tag, Percent, Truck, RotateCcw, MessageSquare, Users, Boxes, Settings } from "lucide-react";
import { useDevOrderMock } from "@/lib/supabase";

export function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { logout } = useAuth();
  const [, setNavLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setNavLocation("/admin/login");
  };

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
    { label: "Messages", href: "/admin/messages", icon: MessageSquare },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Products", href: "/admin/products", icon: Package },
    { label: "Inventory", href: "/admin/inventory", icon: Boxes },
    { label: "Categories", href: "/admin/categories", icon: Tag },
    { label: "Discount Codes", href: "/admin/discount-codes", icon: Percent },
    { label: "Shipping", href: "/admin/shipping", icon: Truck },
    { label: "Returns", href: "/admin/returns", icon: RotateCcw },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out flex flex-col
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-border justify-between md:justify-start">
          <span className="font-display text-2xl font-black text-primary uppercase tracking-widest">S! WEAR ADMIN</span>
          <button className="md:hidden text-white" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 py-6 flex flex-col gap-1 px-4 overflow-y-auto">
          {navItems.map(item => {
            const isActive =
              location === item.href ||
              (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 uppercase tracking-widest text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}

          <div className="my-4 border-t border-border mx-4" />

          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 uppercase tracking-widest text-sm font-bold text-muted-foreground hover:text-white hover:bg-white/5 border-l-2 border-transparent transition-colors"
          >
            <Store size={18} />
            BACK TO STORE
          </Link>
        </div>

        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-4 px-2 uppercase tracking-widest">
            Logged in as Admin
            {useDevOrderMock && (
              <span className="ml-2 bg-primary text-black px-2 py-0.5 font-black">DEV MOCK</span>
            )}
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 uppercase tracking-widest text-sm font-bold transition-colors"
          >
            <LogOut size={18} />
            LOGOUT
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-4 md:hidden">
          <button className="text-white" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <span className="ml-4 font-display text-xl font-black text-primary uppercase tracking-widest">ADMIN</span>
        </header>

        <main data-route-scroll-root className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
