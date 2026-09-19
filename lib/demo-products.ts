export type DemoProduct = {
  id: string;
  name: string;
  price: number;
  category_type: string;
  image_url: string;
  listerName: string;
};

export const demoProducts: DemoProduct[] = [
  {
    id: "demo-grace-hoodie",
    name: "Grace Oversized Hoodie",
    price: 48,
    category_type: "Clothing & accessories",
    image_url: "/demo-products/grace-hoodie.svg",
    listerName: "Covenant Supply",
  },
  {
    id: "demo-kingdom-tee",
    name: "Kingdom Heavyweight Tee",
    price: 28,
    category_type: "Clothing & accessories",
    image_url: "/demo-products/kingdom-tee.svg",
    listerName: "Narrow Way",
  },
  {
    id: "demo-chosen-cap",
    name: "Chosen Embroidered Cap",
    price: 22,
    category_type: "Clothing & accessories",
    image_url: "/demo-products/chosen-cap.svg",
    listerName: "Selah Studio",
  },
  {
    id: "demo-scripture-journal",
    name: "Scripture Study Journal",
    price: 18,
    category_type: "Books & stationery",
    image_url: "/demo-products/scripture-journal.svg",
    listerName: "Good Soil Paper Co.",
  },
  {
    id: "demo-cross-necklace",
    name: "Minimal Cross Necklace",
    price: 32,
    category_type: "Jewellery",
    image_url: "/demo-products/cross-necklace.svg",
    listerName: "Olive & Light",
  },
  {
    id: "demo-faith-tote",
    name: "Walk By Faith Canvas Tote",
    price: 19,
    category_type: "Gifts",
    image_url: "/demo-products/faith-tote.svg",
    listerName: "Common Ground",
  },
  {
    id: "demo-psalm-print",
    name: "Psalm 23 Art Print",
    price: 16,
    category_type: "Art & prints",
    image_url: "/demo-products/psalm-print.svg",
    listerName: "Still Waters",
  },
  {
    id: "demo-be-still-mug",
    name: "Be Still Stoneware Mug",
    price: 17,
    category_type: "Home & living",
    image_url: "/demo-products/be-still-mug.svg",
    listerName: "Abide Home",
  },
];
