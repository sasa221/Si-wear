import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { apiUrl } from "@/lib/apiClient";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function adminLoginDebug(message: string, value?: string | number): void {
  if (!import.meta.env.PROD) return;
  if (typeof value === "undefined") {
    console.log(`[S! Wear] ${message}`);
  } else {
    console.log(`[S! Wear] ${message}`, value);
  }
}

export default function AdminLoginPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAdmin, loginAdmin } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (isAdmin) {
      adminLoginDebug("navigating to /admin");
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, navigate]);

  const onSubmit = async (data: LoginFormValues) => {
    const loginUrl = apiUrl("/admin/login");
    adminLoginDebug("admin login request started");
    adminLoginDebug("API URL used", loginUrl);

    const result = await loginAdmin(data.email, data.password);
    adminLoginDebug("admin login status code", result.status ?? "network-error");

    if (!result.ok) {
      toast({
        title: "Login Failed",
        description: result.message || "Admin login failed. Please try again.",
        variant: "destructive",
      });
      return;
    }

    adminLoginDebug("admin session stored");
    adminLoginDebug("navigating to /admin");
    navigate("/admin", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card p-8 border border-primary">
        <h1 className="text-3xl font-display font-black uppercase text-primary mb-8 text-center tracking-widest">S! WEAR ADMIN</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs tracking-widest text-primary">Email</FormLabel>
                <FormControl><Input className="bg-background rounded-none border-primary/50 focus-visible:ring-primary" style={{ fontSize: "16px" }} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs tracking-widest text-primary">Password</FormLabel>
                <FormControl><Input type="password" className="bg-background rounded-none border-primary/50 focus-visible:ring-primary" style={{ fontSize: "16px" }} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full h-12 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {form.formState.isSubmitting ? "CHECKING..." : "ACCESS DASHBOARD"}
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}
