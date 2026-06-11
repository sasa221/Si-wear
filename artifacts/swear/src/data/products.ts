export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'T-Shirts' | 'Shirts' | 'Pants' | 'Custom Design';
  sizes: string[];
  colors: string[];
  description: string;
  images: string[];
  isNew?: boolean;
  isBestSeller?: boolean;
}

export const products: Product[] = [
  {
    id: "1",
    name: "Oversized Heavy Cotton T-Shirt",
    price: 299,
    category: "T-Shirts",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: ["Black", "White", "Olive"],
    description: "Heavy 320GSM cotton. Oversized bolivar cut. Ribbed collar. Washed and pre-shrunk.",
    images: [
      "https://picsum.photos/seed/product1a/600/750",
      "https://picsum.photos/seed/product1b/600/750",
      "https://picsum.photos/seed/product1c/600/750"
    ],
    isNew: true,
    isBestSeller: true
  },
  {
    id: "2",
    name: "Custom Design T-Shirt",
    price: 349,
    category: "Custom Design",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: ["Black", "White"],
    description: "Send us your design and we print it on our premium bolivar tee. Minimum 1 piece.",
    images: [
      "https://picsum.photos/seed/product2a/600/750",
      "https://picsum.photos/seed/product2b/600/750",
      "https://picsum.photos/seed/product2c/600/750"
    ],
    isNew: true
  },
  {
    id: "3",
    name: "Boxy Fit Shirt",
    price: 349,
    category: "Shirts",
    sizes: ["M", "L", "XL"],
    colors: ["Black", "Beige", "Olive"],
    description: "100% premium cotton. Boxy cut, dropped shoulders, clean finish.",
    images: [
      "https://picsum.photos/seed/product3a/600/750",
      "https://picsum.photos/seed/product3b/600/750",
      "https://picsum.photos/seed/product3c/600/750"
    ],
    isBestSeller: true
  },
  {
    id: "4",
    name: "Wide Leg Pant",
    price: 399,
    category: "Pants",
    sizes: ["M", "L", "XL", "XXL"],
    colors: ["Black", "Khaki"],
    description: "Wide relaxed fit. High waist. Two side pockets, two back pockets. Heavy twill fabric.",
    images: [
      "https://picsum.photos/seed/product4a/600/750",
      "https://picsum.photos/seed/product4b/600/750",
      "https://picsum.photos/seed/product4c/600/750"
    ],
    isBestSeller: true
  }
];
