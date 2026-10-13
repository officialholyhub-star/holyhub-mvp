export function onboardingCookie(userId: string) { return `hh-setup-${userId}`; }
export function onboardingStep(value?: string) {
  const step = Number(value?.split(':')[0]);
  return Number.isInteger(step) && step >= 1 && step <= 5 ? step : 1;
}
export function hasSubmittedProduct(products: { review_status: string }[]) {
  return products.some(product => ['pending', 'approved', 'rejected'].includes(product.review_status));
}
