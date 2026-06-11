import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { emailOrPhone: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    const success = login(data.emailOrPhone, data.password);
    if (success) {
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get("redirect") || "/";
      setLocation(redirect);
    } else {
      toast({
        title: "Error",
        description: "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link href="/" className="font-display text-6xl text-white font-black hover:text-primary transition-colors mb-12">
        S!
      </Link>
      <div className="w-full max-w-md bg-card p-8 border border-border">
        <h1 className="text-3xl font-display font-black uppercase text-white mb-8 text-center">LOGIN</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="emailOrPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Email or Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email or phone" className="bg-background rounded-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your password" className="bg-background rounded-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button type="submit" className="w-full h-12 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors" data-testid="button-login">
              SIGN IN
            </button>
          </form>
        </Form>
        <div className="mt-6 text-center">
          <Link href="/signup" className="text-sm text-muted-foreground hover:text-white transition-colors">
            DON'T HAVE AN ACCOUNT? SIGN UP
          </Link>
        </div>
      </div>
    </div>
  );
}
