import { requireUser } from "@/lib/auth/require-user";
import { CustomerOnboarding } from "@/components/customer-onboarding";

export default async function CustomerSetupPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user } = await requireUser();
  const params = await searchParams;
  return <CustomerOnboarding userId={user.id} editPreferences={params.edit === "1"} />;
}
