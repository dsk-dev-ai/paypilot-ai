import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { CATALOG, CATALOG_CURRENCY } from "@/lib/catalog/products";
import { StoreGrid } from "@/components/store/StoreGrid";

export const metadata = {
  title: "PayPilot Store — instant digital goods",
  description: "Demo merchant with instant digital fulfillment after a verified PayPal sandbox capture.",
};

export default function StorePage() {
  return (
    <div className="space-y-7 animate-fade-up">
      <SectionTitle
        title="PayPilot Store"
        subtitle="A built-in digital merchant so the entire loop is real: add to plan, sign the mandate, pay with PayPal sandbox, and receive the license instantly."
        right={
          <div className="flex gap-2">
            <ButtonLink href="/agent" size="sm" variant="secondary">
              Ask the agent
            </ButtonLink>
            <ButtonLink href="/plan" size="sm" variant="outline">
              View plan
            </ButtonLink>
          </div>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-muted" glass>
        <p>
          PayPilot is the merchant of record. Payments run on the real PayPal Orders v2 sandbox in{" "}
          <strong className="text-text">{CATALOG_CURRENCY}</strong>; fulfillment is generated server-side
          only after capture is verified.
        </p>
        <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] text-success">
          {CATALOG.length} digital products · instant delivery
        </span>
      </Card>

      <StoreGrid products={CATALOG} />
    </div>
  );
}
