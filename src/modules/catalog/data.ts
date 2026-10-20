import { Product } from "./types";

export const DEMO_CATALOG: Product[] = [
  {
    id: "p-001",
    name: "Wireless Headphones",
    category: "electronics",
    price: 99.99,
    description: "Noise cancelling over-ear headphones",
    attributes: { color: "black", warranty: "1y" },
  },
  {
    id: "p-002",
    name: "Coffee Maker",
    category: "kitchen",
    price: 79.49,
    description: "12-cup programmable coffee maker",
    attributes: { color: "silver", capacity_cups: 12 },
  },
  {
    id: "p-003",
    name: "Running Shoes",
    category: "footwear",
    price: 89.95,
    description: "Lightweight running shoes",
    attributes: { size: "9", color: "blue" },
  },
  {
    id: "p-004",
    name: "Desk Lamp",
    category: "home",
    price: 24.5,
    description: "LED desk lamp with dimmer",
    attributes: { color: "white", adjustable: true },
  },
  {
    id: "p-005",
    name: "Backpack",
    category: "accessories",
    price: 59.25,
    description: "Water resistant laptop backpack",
    attributes: { color: "gray", laptop_compatible: true },
  },
];
