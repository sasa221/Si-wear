import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const { login, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) {
      setLocation("/admin");
    }
  }, [isAdmin, setLocation]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    const success = login(data.email, data.password);
    if (success) {
      // Re-check isAdmin after login in a small timeout to let state update, or handle it via useEffect above.
      // But we need to ensure the logged in user actually is admin. The AuthContext login sets user.
      // Let the useEffect handle redirection. But if not admin, we should logout and show error.
      setTimeout(() => {
        const currentUser = JSON.parse(localStorage.getItem("swear_current_user") || "{}");
        if (currentUser.isAdmin) {
          setLocation("/admin");
        } else {
          toast({ title: "Access Denied", description: "You don't have admin privileges.", variant: "destructive" });
        }
      }, 50);
    } else {
      toast({ title: "Error", description: "Invalid credentials", variant: "destructive" });
    }
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
                <FormControl><Input className="bg-background rounded-none border-primary/50 focus-visible:ring-primary" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs tracking-widest text-primary">Password</FormLabel>
                <FormControl><Input type="password" className="bg-background rounded-none border-primary/50 focus-visible:ring-primary" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <button type="submit" className="w-full h-12 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors">
              ACCESS DASHBOARD
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}
