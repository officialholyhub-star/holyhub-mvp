import { BasketView } from "@/components/basket-view";

export default async function BasketPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <BasketView error={params.error} />;
}