import type { ProductCategory } from "./product-categories";

export type DemoProduct = {
  id: string;
  name: string;
  price: number;
  category_type: ProductCategory;
  image_url: string;
  listerName: string;
};

// Development/test fixture only. Production exports an empty list so fake
// catalogue data cannot accidentally be rendered to customers.
const demoProductFixtures: DemoProduct[] = [
  { id: "demo-grace-hoodie", name: "Grace Oversized Hoodie", price: 48, category_type: "Apparel", image_url: "/images/creator-studio.jpg", listerName: "Covenant Supply" },
  { id: "demo-kingdom-tee", name: "Kingdom Heavyweight Tee", price: 28, category_type: "Apparel", image_url: "/images/community-lifestyle.jpg", listerName: "Narrow Way" },
  { id: "demo-chosen-cap", name: "Chosen Embroidered Cap", price: 22, category_type: "Apparel", image_url: "/images/creator-studio.jpg", listerName: "Selah Studio" },
  { id: "demo-scripture-journal", name: "Scripture Study Journal", price: 18, category_type: "Books", image_url: "/images/community-lifestyle.jpg", listerName: "Good Soil Paper Co." },
  { id: "demo-cross-necklace", name: "Minimal Cross Necklace", price: 32, category_type: "Jewellery", image_url: "/images/creator-studio.jpg", listerName: "Olive & Light" },
  { id: "demo-faith-tote", name: "Walk By Faith Canvas Tote", price: 19, category_type: "Gifts", image_url: "/images/community-lifestyle.jpg", listerName: "Common Ground" },
  { id: "demo-psalm-print", name: "Psalm 23 Art Print", price: 16, category_type: "Arts", image_url: "/images/creator-studio.jpg", listerName: "Still Waters" },
  { id: "demo-be-still-mug", name: "Be Still Stoneware Mug", price: 17, category_type: "Home & Living", image_url: "/images/community-lifestyle.jpg", listerName: "Abide Home" },
];

export const demoProducts: DemoProduct[] = process.env.NODE_ENV === "development" ? demoProductFixtures : [];
