import { SectionTitle, Card } from "@/components/ui/Card";

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-up">
      <SectionTitle title="Help & disclosures" subtitle="How Mandate works, what it can and cannot do, and the fine print." />

      <Card className="space-y-3 p-6 text-sm text-muted">
        <h2 className="text-base font-semibold text-text">What Mandate is</h2>
        <p>
          Mandate is a shopping agent. It searches product providers you have authorized
          (via API credentials), compares their real listings, validates your plan against your
          own purchase rules (a Purchase Mandate), and routes each item to a correct checkout:
          Mandate&apos;s PayPal checkout where supported, or the official retailer page otherwise.
        </p>
        <h2 className="pt-2 text-base font-semibold text-text">What Mandate is not</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>It is not a universal cart. Adding an item to your Mandate plan does not add it to any retailer&apos;s cart.</li>
          <li>It does not automate retailer logins, carts or checkout on third-party sites.</li>
          <li>It never invents prices, stock levels or ratings. Unknown values are shown as unknown.</li>
          <li>Opening an official retailer page is a handoff, not a purchase. Orders are only marked paid after a verified payment capture.</li>
        </ul>
        <h2 className="pt-2 text-base font-semibold text-text">Affiliate disclosure</h2>
        <p>
          Mandate may earn a commission when you buy through qualifying affiliate links (for
          example Flipkart). Commissions never change ranking or price — recommendations cite the
          listing data shown.
        </p>
        <h2 className="pt-2 text-base font-semibold text-text">Payments</h2>
        <p>
          PayPal checkout runs in sandbox mode unless explicitly configured otherwise. Card
          details are never stored by Mandate; all payment entry happens on PayPal&apos;s own site.
        </p>
        <h2 className="pt-2 text-base font-semibold text-text">Privacy</h2>
        <p>
          Mandate stores your plan, orders and an anonymous session identifier to keep your data
          attached to you. No retailer passwords or card data are ever collected. You can clear
          everything by clearing your browser data for this site.
        </p>
      </Card>
    </div>
  );
}
