BEGIN;

REVOKE EXECUTE ON FUNCTION
  public.process_checkout_payment(text,text,text,integer,text,text,jsonb),
  public.match_payment_charge(uuid,text,text,integer,integer),
  public.sync_payment_order(uuid),
  public.request_payment_refund(uuid,text,jsonb,integer,text,boolean),
  public.reserve_seller_transfer(uuid),
  public.account_payment_refund(uuid),
  public.claim_payment_operation(uuid),
  public.settle_payment_operation(uuid,uuid,text,text,integer,text),
  public.restore_payment_stock(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.process_checkout_payment(text,text,text,integer,text,text,jsonb),
  public.match_payment_charge(uuid,text,text,integer,integer),
  public.sync_payment_order(uuid),
  public.request_payment_refund(uuid,text,jsonb,integer,text,boolean),
  public.reserve_seller_transfer(uuid),
  public.account_payment_refund(uuid),
  public.claim_payment_operation(uuid),
  public.settle_payment_operation(uuid,uuid,text,text,integer,text),
  public.restore_payment_stock(uuid)
TO service_role;

REVOKE EXECUTE ON FUNCTION
  public.cancel_seller_order_with_refund(uuid,text,text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.cancel_seller_order_with_refund(uuid,text,text)
TO authenticated, service_role;

COMMIT;
