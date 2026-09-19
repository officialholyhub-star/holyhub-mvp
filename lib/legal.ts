export const HOLYHUB_LEGAL = {
  operator: "Alea Daniel trading as HolyHub",
  legalName: "Alea Daniel",
  tradingName: "HolyHub",
  businessType: "sole trader",
  email: "Official.holyhub@gmail.com",
  address: process.env.HOLYHUB_BUSINESS_ADDRESS ?? "Business address to be added before launch",
  lastUpdated: "19 September 2026",
} as const;
