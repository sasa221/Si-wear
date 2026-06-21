import { motion } from "framer-motion";

type PolicySection = {
  title: string;
  body: string;
};

function PolicyLayout({ title, sections }: { title: string; sections: PolicySection[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto px-4 py-16 md:py-24"
    >
      <h1
        className="font-display font-black uppercase text-white mb-8"
        style={{ fontSize: "clamp(2rem, 7vw, 4.5rem)", lineHeight: 0.95 }}
      >
        {title}
      </h1>
      <div className="bg-card border border-border p-5 sm:p-8 space-y-8">
        {sections.map(section => (
          <section key={section.title}>
            <h2 className="font-display text-xl uppercase tracking-widest text-white mb-3">{section.title}</h2>
            <p className="text-muted-foreground leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>
    </motion.div>
  );
}

export function ShippingPolicyPage() {
  return (
    <PolicyLayout
      title="Shipping Policy"
      sections={[
        {
          title: "Delivery Areas",
          body: "S! Wear ships from Hadayek Al Ahram, Giza to customers across Egypt. Delivery fees are calculated at checkout based on governorate and city or area.",
        },
        {
          title: "Delivery Time",
          body: "Most orders arrive within 3 to 7 business days after confirmation. Busy seasons or remote areas may take longer.",
        },
        {
          title: "Payment",
          body: "All online store orders are Cash on Delivery in EGP. Please keep your phone available so customer support can confirm details if needed.",
        },
      ]}
    />
  );
}

export function ReturnsExchangePolicyPage() {
  return (
    <PolicyLayout
      title="Returns & Exchange"
      sections={[
        {
          title: "Eligibility",
          body: "Delivered orders can request a return or exchange from the order details page. Items must be unworn, unwashed, and in original condition with tags attached.",
        },
        {
          title: "Custom Designs",
          body: "Custom Design requests are handled separately through WhatsApp and are final sale unless the item is defective or the delivered piece does not match the approved design.",
        },
        {
          title: "Review",
          body: "Admin reviews each request and updates the status to Accepted, Rejected, or Completed. Customers receive a notification when the request changes.",
        },
      ]}
    />
  );
}

export function PrivacyPolicyPage() {
  return (
    <PolicyLayout
      title="Privacy Policy"
      sections={[
        {
          title: "Data We Use",
          body: "We use your name, phone number, delivery address, and order details to confirm and deliver your S! Wear order.",
        },
        {
          title: "Storage",
          body: "Orders and notifications are saved in Supabase when connected. Cart data stays in your browser so checkout stays fast.",
        },
        {
          title: "Contact",
          body: "We do not sell customer data. Contact details are used only for order support, delivery confirmation, and service messages.",
        },
      ]}
    />
  );
}

export function TermsConditionsPage() {
  return (
    <PolicyLayout
      title="Terms & Conditions"
      sections={[
        {
          title: "Orders",
          body: "By placing an order, you confirm that your phone number and delivery address are correct and that you can pay Cash on Delivery in EGP.",
        },
        {
          title: "Availability",
          body: "Products are sold based on available size and color stock. If stock changes before confirmation, customer support may contact you with options.",
        },
        {
          title: "Use",
          body: "Do not submit fake orders, repeated spam messages, or incorrect contact details. S! Wear may cancel orders that cannot be confirmed.",
        },
      ]}
    />
  );
}
