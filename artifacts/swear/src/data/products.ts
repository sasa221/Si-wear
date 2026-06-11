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
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&h=750&fit=crop"
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
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=600&h=750&fit=crop"
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
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1555274175-6cbf6f3b137b?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&h=750&fit=crop"
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
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=750&fit=crop"
    ],
    isBestSeller: true
  }
];
