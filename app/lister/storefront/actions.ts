"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { onboardingCookie } from "@/lib/lister-onboarding";
import { applicationCategoryValue } from "@/lib/application-categories";
import { dispatchValidationError } from "@/lib/dispatch-timeframe";
import { isValidHttpUrl } from "@/lib/product-validation";
import type { StorefrontFormState } from "@/app/lister/actions";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDeliveryCharge(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const charge = Number(value);
  return Number.isFinite(charge) && charge >= 0 ? charge : null;
}

const LISTER_LOGO_BUCKET = "lister-logos";

function ownedListerLogoPath(imageUrl: string, userId: string) {
  try {
    const image = new URL(imageUrl);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || image.origin !== new URL(supabaseUrl).origin) return null;
    const prefix = `/storage/v1/object/public/${LISTER_LOGO_BUCKET}/${userId}/`;
    if (!image.pathname.startsWith(prefix)) return null;
    const filename = decodeURIComponent(image.pathname.slice(prefix.length));
    if (!filename || filename.includes("/") || filename.includes("\\")) return null;
    return `${userId}/${filename}`;
  } catch {
    return null;
  }
}

async function removeOwnedListerLogo(
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
  imageUrl: string,
  userId: string,
) {
  const path = ownedListerLogoPath(imageUrl, userId);
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(LISTER_LOGO_BUCKET).remove([path]);
    if (error) console.error("Lister logo cleanup failed", { code: error.name, message: error.message });
  } catch (error) {
    console.error("Lister logo cleanup failed", error);
  }
}

export async function saveStorefront(
  _previousState: StorefrontFormState,
  formData: FormData,
): Promise<StorefrontFormState> {
  const businessName = clean(formData.get("business_name"));
  const description = clean(formData.get("description"));
  const categoryType = applicationCategoryValue(
    clean(formData.get("category_type")),
    clean(formData.get("suggested_category")),
  );
  const websiteUrl = clean(formData.get("website_url"));
  const instagramUrl = clean(formData.get("instagram_url"));
  const logoUrl = clean(formData.get("logo_url"));
  const deliveryChargeValue = clean(formData.get("delivery_charge"));
  const deliveryCharge = parseDeliveryCharge(deliveryChargeValue);
  const dispatchWindow = clean(formData.get("dispatch_window"));
  const dispatchCustomTimeframe = clean(formData.get("dispatch_custom_timeframe"));
  const dispatchError = dispatchValidationError(dispatchWindow, dispatchCustomTimeframe);
  const { supabase, user } = await requireRole("lister");

  if (dispatchError) return { error: dispatchError };
  if (
    !businessName || businessName.length > 150
    || !description || description.length > 500
    || !categoryType || categoryType.length > 100
    || websiteUrl.length > 500 || instagramUrl.length > 500
    || !isValidHttpUrl(websiteUrl) || !isValidHttpUrl(instagramUrl)
    || deliveryCharge === null || !deliveryChargeValue || logoUrl.length > 500
  ) {
    return { error: "Complete the storefront and delivery settings with valid values." };
  }

  const { data: existingStorefront, error: lookupError } = await supabase
    .from("lister_storefronts")
    .select("user_id, logo_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("Lister storefront lookup failed", {
      code: lookupError.code,
      message: lookupError.message,
      details: lookupError.details,
      hint: lookupError.hint,
    });
    return { error: "We couldn't load your shop. Please refresh before trying again." };
  }

  const logoIsAllowed = !logoUrl
    || logoUrl === existingStorefront?.logo_url
    || ownedListerLogoPath(logoUrl, user.id) !== null;
  if (!logoIsAllowed) return { error: "Choose a logo uploaded to your storefront." };

  const storefrontValues = {
    business_name: businessName,
    description,
    category_type: categoryType,
    website_url: websiteUrl || null,
    instagram_url: instagramUrl || null,
    logo_url: logoUrl || null,
    delivery_option: deliveryCharge === 0 ? "free" : "flat",
    delivery_charge: deliveryCharge,
    delivery_country: "GB",
    dispatch_window: dispatchWindow,
    dispatch_custom_timeframe: dispatchWindow === "working-days" || dispatchWindow === "made-to-order" ? dispatchCustomTimeframe : null,
    updated_at: new Date().toISOString(),
  };

  const saveResult = existingStorefront
    ? await supabase.from("lister_storefronts").update(storefrontValues).eq("user_id", user.id).select("user_id").maybeSingle()
    : await supabase.from("lister_storefronts").insert({ ...storefrontValues, user_id: user.id }).select("user_id").maybeSingle();

  if (saveResult.error || !saveResult.data) {
    console.error("Lister storefront save failed", {
      code: saveResult.error?.code,
      message: saveResult.error?.message,
      details: saveResult.error?.details,
      hint: saveResult.error?.hint,
    });
    return { error: "We couldn't confirm your shop was saved. Your entered details are still here. Refresh to check the latest settings before trying again." };
  }

  if (existingStorefront?.logo_url && existingStorefront.logo_url !== logoUrl) {
    await removeOwnedListerLogo(supabase, existingStorefront.logo_url, user.id);
  }

  revalidatePath("/lister/storefront");
  revalidatePath("/marketplace");
  revalidatePath(`/lister/storefront/${user.id}`);
  revalidatePath("/account");
  if (formData.get("onboarding") === "1") {
    (await cookies()).set(onboardingCookie(user.id), "3:later", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 31536000,
    });
    redirect("/lister/onboarding");
  }
  redirect("/account?message=Storefront%20saved.");
}
