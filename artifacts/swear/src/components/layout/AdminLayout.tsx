import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Menu, X, LayoutDashboard, ShoppingBag, Package, LogOut, Store } from "lucide-react";

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
    { label: "Products", href: "/admin/products", icon: Package },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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

        <div className="flex-1 py-6 flex flex-col gap-2 px-4 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/admin");
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
          <p className="text-xs text-muted-foreground mb-4 px-2 uppercase tracking-widest">Logged in as Admin</p>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 uppercase tracking-widest text-sm font-bold transition-colors"
          >
            <LogOut size={18} />
            LOGOUT
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-4 md:hidden">
          <button className="text-white" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <span className="ml-4 font-display text-xl font-black text-primary uppercase tracking-widest">ADMIN</span>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
