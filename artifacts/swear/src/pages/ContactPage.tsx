import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { dbCreateContactMessage } from "@/lib/contactService";
import { SUPABASE_NOT_CONNECTED_MESSAGE, supabaseConfigured, useDevOrderMock } from "@/lib/supabase";
import { ACCOUNT_RESTRICTED_MESSAGE, dbGetCurrentUserAccountStatus } from "@/lib/userService";
import { defaultStoreSettings, getStoreSettings, type StoreSettings } from "@/lib/storeSettings";
import { Facebook, Instagram, Loader2, MapPin, Music, Phone } from "lucide-react";

const CONTACT_LAST_SENT_KEY = "swear_contact_last_sent";
const CONTACT_SIGNATURES_KEY = "swear_contact_signatures";
const CONTACT_COOLDOWN_MS = 60_000;

const contactSchema = z.object({
  subject: z.string().trim().min(3, "Subject is required"),
  message: z.string().trim().min(10, "Please provide a more detailed message"),
  orderId: z.string().trim().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

function messageSignature(data: ContactFormValues): string {
  return `${data.subject.trim().toLowerCase()}::${data.message.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function readSignatures(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTACT_SIGNATURES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ContactPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      subject: "",
      message: "",
      orderId: "",
    },
  });

  useEffect(() => {
    if (!user) setLocation("/login?redirect=/contact");
  }, [user, setLocation]);

  useEffect(() => {
    let cancelled = false;
    getStoreSettings()
      .then(data => {
        if (!cancelled) setSettings(data);
      })
      .catch(err => console.error("Failed to load store settings:", err));
    return () => { cancelled = true; };
  }, []);

  if (!user) return null;
  const accountRestricted = user.blocked === true || user.isActive === false;
  const socialLinks = [
    { label: "Instagram", href: settings.instagramUrl, icon: <Instagram size={24} /> },
    { label: "TikTok", href: settings.tiktokUrl, icon: <Music size={24} /> },
    { label: "Facebook", href: settings.facebookUrl, icon: <Facebook size={24} /> },
  ].filter(link => link.href);

  const onSubmit = async (data: ContactFormValues) => {
    setSuccessMessage("");
    if (accountRestricted) {
      toast({
        title: "Account restricted",
        description: ACCOUNT_RESTRICTED_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    const now = Date.now();
    const lastSent = Number(localStorage.getItem(CONTACT_LAST_SENT_KEY) || 0);
    if (now - lastSent < CONTACT_COOLDOWN_MS) {
      toast({
        title: "Please wait",
        description: "You can send another message in about one minute.",
        variant: "destructive",
      });
      return;
    }

    const signature = messageSignature(data);
    const signatures = readSignatures();
    if (signatures.includes(signature)) {
      toast({
        title: "Duplicate message",
        description: "Please change your message before sending it again.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const accountStatus = await dbGetCurrentUserAccountStatus(user.id);
      if (accountStatus?.blocked || accountStatus?.isActive === false) {
        throw new Error(ACCOUNT_RESTRICTED_MESSAGE);
      }
      await dbCreateContactMessage({
        customerId: user.id,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        subject: data.subject,
        message: data.message,
        orderId: data.orderId || null,
      });
      localStorage.setItem(CONTACT_LAST_SENT_KEY, String(now));
      localStorage.setItem(CONTACT_SIGNATURES_KEY, JSON.stringify([signature, ...signatures].slice(0, 30)));
      form.reset();
      setSuccessMessage("Message sent. We'll reply soon.");
    } catch (err) {
      toast({
        title: "Message not sent",
        description: err instanceof Error ? err.message : "Failed to send message.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-24"
    >
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-12 text-center">HIT US UP</h1>

      {!supabaseConfigured && (
        <div className="max-w-6xl mx-auto mb-6 border border-red-500/50 bg-red-500/10 p-4 text-xs uppercase tracking-widest text-red-400">
          <div className="flex flex-wrap items-center gap-2">
            {useDevOrderMock && (
              <span className="bg-primary text-black px-2 py-0.5 font-black">DEV MOCK</span>
            )}
            <span>{SUPABASE_NOT_CONNECTED_MESSAGE}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
        <div className="flex flex-col justify-center space-y-10">
          <div>
            <h2 className="text-3xl font-display uppercase text-white mb-6">CUSTOMER SUPPORT</h2>
            <p className="text-muted-foreground mb-8">
              Send us a message about sizing, order status, delivery, returns, or anything S! Wear related.
            </p>

            <div className="space-y-3 max-w-md">
              <a href={`tel:+${settings.whatsappNumber.replace(/[^\d]/g, "")}`} className="flex items-center gap-4 text-white hover:text-primary transition-colors group p-4 border border-border bg-card">
                <Phone className="text-primary group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                  <span className="uppercase tracking-widest text-xs text-muted-foreground">Phone</span>
                  <span className="font-bold tracking-wider">{settings.supportInfo}</span>
                </div>
              </a>
              <div className="flex items-center gap-4 text-white p-4 border border-border bg-card">
                <MapPin className="text-primary" />
                <div className="flex flex-col">
                  <span className="uppercase tracking-widest text-xs text-muted-foreground">Location</span>
                  <span className="font-bold tracking-wider">{settings.storeLocation}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-display uppercase text-white mb-6">SOCIAL</h2>
            <div className="flex gap-4">
              {socialLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-14 h-14 bg-card border border-border flex items-center justify-center text-white hover:text-primary hover:border-primary transition-all"
                  aria-label={link.label}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card p-8 md:p-10 border border-border">
          <h2 className="text-2xl font-display uppercase text-white mb-3">SEND A MESSAGE</h2>
          <div className="mb-8 border-b border-border pb-4 text-sm text-muted-foreground">
            <p className="text-white font-bold">{user.name}</p>
            <p>{user.email}</p>
            <p>{user.phone}</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {accountRestricted && (
                <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {ACCOUNT_RESTRICTED_MESSAGE}
                </div>
              )}

              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Order question, sizing, delivery..." className="bg-background rounded-none h-12" style={{ fontSize: "16px" }} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="orderId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Optional Order Number</FormLabel>
                  <FormControl>
                    <Input placeholder="SW..." className="bg-background rounded-none h-12" style={{ fontSize: "16px" }} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="message" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Message</FormLabel>
                  <FormControl>
                    <Textarea placeholder="How can we help?" className="bg-background rounded-none min-h-[150px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {successMessage && (
                <div className="border border-primary/40 bg-primary/10 px-4 py-3 text-primary text-sm">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || accountRestricted || (!supabaseConfigured && !useDevOrderMock)}
                className="w-full h-14 bg-white text-black font-display font-bold uppercase tracking-widest text-lg hover:bg-primary transition-colors mt-4 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          </Form>
        </div>
      </div>
    </motion.div>
  );
}
