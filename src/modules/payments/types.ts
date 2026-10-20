export type PayPalOrder = {
  id: string;
  status: string;
  intent?: string;
  purchase_units?: Array<{
    amount?: {
      currency_code?: string;
      value?: string;
    };
  }>;
  links?: Array<{ href: string; rel: string; method: string }>;
};

export type PayPalCaptureResponse = unknown;
