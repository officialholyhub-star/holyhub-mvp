import { requireUser } from "@/lib/auth/require-user";
import { CustomerOnboarding } from "@/components/customer-onboarding";
import { redirect } from "next/navigation";

export default async function CustomerSetupPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user } = await requireUser();
  const params = await searchParams;
  if (params.edit !== "1" && user.user_metadata?.customer_setup_complete === true) redirect("/account");
  return <CustomerOnboarding userId={user.id} editPreferences={params.edit === "1"} />;
}
