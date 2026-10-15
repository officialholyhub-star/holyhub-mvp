import { CustomerOnboarding } from "@/components/customer-onboarding";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <CustomerOnboarding error={params.error} />;
}
