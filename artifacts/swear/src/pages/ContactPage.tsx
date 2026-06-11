import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, Instagram, Facebook } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  contact: z.string().min(5, "Email or phone is required"),
  message: z.string().min(10, "Please provide a more detailed message")
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      contact: "",
      message: ""
    }
  });

  const onSubmit = (data: ContactFormValues) => {
    const message = `CONTACT FORM\nName: ${data.name}\nContact: ${data.contact}\n\nMessage: ${data.message}`;
    window.open(`https://wa.me/201220172714?text=${encodeURIComponent(message)}`, "_blank");
    form.reset();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-24"
    >
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-12 text-center">HIT US UP</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
        {/* Info */}
        <div className="flex flex-col justify-center space-y-12">
          <div>
            <h2 className="text-3xl font-display uppercase text-white mb-6">CUSTOMER SUPPORT</h2>
            <p className="text-muted-foreground mb-8">Got a question about sizing, order status, or a custom design? Reach out directly. We typically reply within a few hours.</p>
            
            <a href="https://wa.me/201220172714" target="_blank" rel="noreferrer" className="flex items-center gap-4 text-white hover:text-primary transition-colors group p-4 border border-border bg-card max-w-md">
              <Phone className="text-primary group-hover:scale-110 transition-transform" />
              <div className="flex flex-col">
                <span className="uppercase tracking-widest text-xs text-muted-foreground">WhatsApp Only</span>
                <span className="font-bold tracking-wider">+20 122 017 2714</span>
              </div>
            </a>
          </div>
          
          <div>
            <h2 className="text-3xl font-display uppercase text-white mb-6">SOCIAL</h2>
            <div className="flex gap-4">
              <a href="#" className="w-14 h-14 bg-card border border-border flex items-center justify-center text-white hover:text-primary hover:border-primary transition-all">
                <Instagram size={24} />
              </a>
              <a href="#" className="w-14 h-14 bg-card border border-border flex items-center justify-center text-white hover:text-primary hover:border-primary transition-all">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
              </a>
              <a href="#" className="w-14 h-14 bg-card border border-border flex items-center justify-center text-white hover:text-primary hover:border-primary transition-all">
                <Facebook size={24} />
              </a>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-card p-8 md:p-10 border border-border">
          <h2 className="text-2xl font-display uppercase text-white mb-8 border-b border-border pb-4">SEND A MESSAGE</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" className="bg-background rounded-none h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Email or Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="How should we reach you?" className="bg-background rounded-none h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Message</FormLabel>
                    <FormControl>
                      <Textarea placeholder="What's on your mind?" className="bg-background rounded-none min-h-[150px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <button type="submit" className="w-full h-14 bg-white text-black font-display font-bold uppercase tracking-widest text-lg hover:bg-primary transition-colors mt-4">
                SEND MESSAGE
              </button>
            </form>
          </Form>
        </div>
      </div>
    </motion.div>
  );
}
