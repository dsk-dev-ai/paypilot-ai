export type Product = {
  id: string;
  name: string;
  category: string;
  price: number; // cents or dollars? use number, document as currency units
  description: string;
  attributes: Record<string, string | number | boolean>;
};

export type Catalog = Product[];
