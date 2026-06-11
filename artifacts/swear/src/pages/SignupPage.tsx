import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().regex(/^01[0-9]{9}$/, "Must be exactly 11 digits starting with 01"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { signup } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", phone: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = (data: SignupFormValues) => {
    const success = signup(data.name, data.phone, data.email, data.password);
    if (success) {
      setLocation("/");
    } else {
      toast({
        title: "Error",
        description: "Email already registered",
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
        <h1 className="text-3xl font-display font-black uppercase text-white mb-8 text-center">SIGN UP</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" className="bg-background rounded-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="01XXXXXXXXX" className="bg-background rounded-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" className="bg-background rounded-none" {...field} />
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
                    <Input type="password" placeholder="Min 8 characters" className="bg-background rounded-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Confirm password" className="bg-background rounded-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button type="submit" className="w-full h-12 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors" data-testid="button-signup">
              CREATE ACCOUNT
            </button>
          </form>
        </Form>
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-white transition-colors">
            ALREADY HAVE AN ACCOUNT? SIGN IN
          </Link>
        </div>
      </div>
    </div>
  );
}
