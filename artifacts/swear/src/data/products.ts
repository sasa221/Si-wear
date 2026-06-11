export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  sizes: string[];
  colors: string[];
  description: string;
  images: string[];
  isNew?: boolean;
  isBestSeller?: boolean;
}

export const defaultCategories: string[] = [
  "T-Shirts",
  "Shirts",
  "Pants",
  "Hoodies",
  "Custom Design",
];

export const defaultProducts: Product[] = [
  {
    id: "1",
    name: "Shadow Oversize Tee",
    price: 299,
    category: "T-Shirts",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: ["Black", "White", "Stone"],
    description:
      "320GSM heavyweight cotton. Bolivar oversized fit with dropped shoulders and ribbed collar. Pre-washed and pre-shrunk for maximum comfort straight out the bag.",
    images: [
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=750&fit=crop",
    ],
    isNew: true,
    isBestSeller: true,
  },
  {
    id: "2",
    name: "Washed Vintage Tee",
    price: 279,
    category: "T-Shirts",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: ["Black", "Sand", "Vintage White"],
    description:
      "250GSM cotton with an acid-washed finish for a lived-in feel. Relaxed bolivar cut. A staple piece that only gets better with every wash.",
    images: [
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop",
    ],
    isNew: true,
  },
  {
    id: "3",
    name: "Boxy Open-Collar Shirt",
    price: 399,
    category: "Shirts",
    sizes: ["M", "L", "XL", "2XL"],
    colors: ["Black", "Ivory", "Sage"],
    description:
      "100% premium cotton. Boxy silhouette with dropped shoulders and an open collar. Clean finish, perfect as a standalone piece or a layering shirt.",
    images: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1555274175-6cbf6f3b137b?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=600&h=750&fit=crop",
    ],
    isBestSeller: true,
  },
  {
    id: "4",
    name: "Oversized Flannel Shirt",
    price: 449,
    category: "Shirts",
    sizes: ["M", "L", "XL", "2XL"],
    colors: ["Black/Grey Check", "Olive/Black Check", "Khaki/Brown Check"],
    description:
      "Heavy-weight flannel fabric. Oversized silhouette with chest pockets and dropped shoulders. Wear it open as a jacket or buttoned as a statement shirt.",
    images: [
      "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1555274175-6cbf6f3b137b?w=600&h=750&fit=crop",
    ],
    isNew: true,
  },
  {
    id: "5",
    name: "Wide Leg Cargo Pant",
    price: 499,
    category: "Pants",
    sizes: ["M", "L", "XL", "2XL"],
    colors: ["Black", "Olive", "Stone"],
    description:
      "Heavy twill fabric. Ultra-wide leg silhouette with a high waist. Six pockets including side cargo pockets. S! Wear signature hardware on every pocket.",
    images: [
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&h=750&fit=crop",
    ],
    isBestSeller: true,
  },
  {
    id: "6",
    name: "Relaxed Pleated Trouser",
    price: 449,
    category: "Pants",
    sizes: ["M", "L", "XL", "2XL"],
    colors: ["Black", "Dark Grey", "Khaki"],
    description:
      "Premium woven fabric. Relaxed straight leg with a high waist and pleated front. Side and back pockets. A clean everyday essential that dresses up or down effortlessly.",
    images: [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=750&fit=crop",
    ],
  },
  {
    id: "7",
    name: "Essential Heavyweight Hoodie",
    price: 599,
    category: "Hoodies",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: ["Black", "Charcoal", "White"],
    description:
      "400GSM heavyweight cotton-fleece. Double-lined hood, kangaroo front pocket, ribbed cuffs. Brushed fleece interior for warmth without bulk. The S! Wear year-round essential.",
    images: [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=750&fit=crop",
    ],
    isNew: true,
    isBestSeller: true,
  },
  {
    id: "8",
    name: "Quarter-Zip Sweatshirt",
    price: 549,
    category: "Hoodies",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: ["Black", "Cream", "Slate Grey"],
    description:
      "350GSM cotton-poly blend. Quarter-zip closure with a brushed fleece interior. Clean minimal silhouette with no logo — just premium construction and a perfect fit.",
    images: [
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?w=600&h=750&fit=crop",
    ],
    isNew: true,
  },
];

export const products = defaultProducts;
