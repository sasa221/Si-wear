import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/apiClient";
import { saveSupabaseAuthSession } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ADMIN_SESSION_KEY = "swear_admin_session";

interface AdminSession {
  user_id: string;
  email: string;
  role: string;
  loggedInAt: string;
}

export default function AdminLoginPage() {
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await fetch(apiUrl("/admin/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email.trim(),
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorCode = result.error || "UNKNOWN_ERROR";
        const errorMessages: Record<string, string> = {
          INVALID_CREDENTIALS: "Invalid email or password",
          PROFILE_NOT_FOUND: "Admin profile not found",
          NOT_ADMIN: "User is not an admin",
          ADMIN_BLOCKED: "Admin account is blocked or inactive",
          SERVER_MISCONFIGURED: "Server configuration error. Please try again later.",
          SERVER_ERROR: "Server error. Please try again later.",
        };
        const message = errorMessages[errorCode] || `Login failed: ${errorCode}`;
        toast({
          title: "Login Failed",
          description: message,
          variant: "destructive",
        });
        return;
      }

      if (result.ok && result.user_id && result.session) {
        // Set Supabase auth session for frontend queries
        const session = {
          accessToken: result.session.access_token,
          refreshToken: result.session.refresh_token,
          expiresAt: result.session.expires_at,
          user: {
            id: result.user_id,
            email: result.email || data.email.trim(),
          },
        };

        if (session.accessToken && session.refreshToken) {
          saveSupabaseAuthSession(session);
          console.log("admin supabase session set");
        } else {
          console.error("Supabase auth session data is missing.");
        }

        // Store safe admin metadata in sessionStorage
        const adminSession: AdminSession = {
          user_id: result.user_id,
          email: result.email || data.email.trim(),
          role: "admin",
          loggedInAt: new Date().toISOString(),
        };
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession));
        console.log("admin login api success");
        console.log("admin session stored");

        // Reload the app shell so AuthProvider hydrates the newly saved admin session.
        window.location.assign("/admin");
      } else {
        toast({
          title: "Login Failed",
          description: "Unexpected response from server",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Admin login error:", err);
      toast({
        title: "Error",
        description: "An error occurred. Please check your connection and try again.",
        variant: "destructive",
      });
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
