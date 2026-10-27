import assert from 'node:assert/strict';
import test from 'node:test';
import Stripe from 'stripe';
import { loadTypescript } from './helpers/load-typescript.mjs';
const { executePaymentOperation, processFinancialWebhook, reconcilePaymentOperation, runPaymentQueue } = loadTypescript('lib/payment-operations.ts', {
  stripe: Stripe,
  '@/lib/stripe': { getStripe() { throw new Error('No real Stripe calls permitted'); } },
  '@/lib/supabase/admin': { createAdminClient() { throw new Error('No real database calls permitted'); } },
});
const base = { id: 'op-1', allocation_id: 'alloc-a', order_id: 'order-1', seller_user_id: 'seller-a',
  payment_intent_id: 'pi_customer', lease_token: 'lease-1', amount: 950, details: {} };
function harness(kind, overrides = {}) {
  const calls = []; const settlements = [];
  const op = { ...base, kind, ...overrides };
  const admin = { rpc: async (name, args) => {
    if (name === 'claim_payment_operation') return { data: op, error: null };
    settlements.push(args); return { data: null, error: null };
  } };
  const stripe = {
    accounts: { retrieve: async () => ({ capabilities: { transfers: 'active' } }) },
    refunds: { create: async (params, options) => {
      calls.push({ params, options }); return { id: 're_customer', ...params, currency: 'gbp', status: 'succeeded' };
    } },
    transfers: {
      create: async (params, options) => { calls.push({ params, options }); return { id: 'tr_seller_a', ...params }; },
      createReversal: async (id, params, options) => { calls.push({ id, params, options }); return { id: 'trr_seller_a', transfer: id, ...params }; },
    },
  };
  return { op, admin, stripe, calls, settlements };
}
test('worker uses one platform payment refund with stable durable idempotency key', async () => {
  const h = harness('refund'); await executePaymentOperation('op-1', h.admin, h.stripe);
  assert.equal(h.calls[0].params.payment_intent, 'pi_customer');
  assert.equal(h.calls[0].params.amount, 950); assert.equal(h.calls[0].options.idempotencyKey, 'holyhub:c11:op-1');
  assert.equal(h.settlements[0].p_stripe_id, 're_customer');
});
test('seller transfer uses separate charges/transfers with source charge and one seller destination', async () => {
  const h = harness('transfer', { details: { destination: 'acct_seller_a', charge: 'ch_platform' } });
  await executePaymentOperation('op-1', h.admin, h.stripe);
  const params = h.calls[0].params;
  assert.equal(params.destination, 'acct_seller_a'); assert.equal(params.source_transaction, 'ch_platform');
  assert.equal(params.transfer_group, 'holyhub:order-1'); assert.equal(params.application_fee_amount, undefined);
});
test('pending refunds remain pending rather than prematurely creating seller debt', async () => {
  const h = harness('refund'); h.stripe.refunds.create = async p => ({ id: 're_pending', ...p, currency: 'gbp', status: 'pending' });
  await executePaymentOperation('op-1', h.admin, h.stripe); assert.equal(h.settlements[0].p_status, 'pending');
});
test('insufficient seller balance produces verified recovery failure without another customer refund', async () => {
  const h = harness('reversal', { details: { transfer_id: 'tr_seller_a' } });
  h.stripe.transfers.createReversal = async () => { throw new Stripe.errors.StripeInvalidRequestError({ message: 'not available', code: 'balance_insufficient' }); };
  assert.equal(await executePaymentOperation('op-1', h.admin, h.stripe), 'seller_debt');
  assert.equal(h.settlements[0].p_status, 'failed'); assert.equal(h.settlements[0].p_failure_code, 'seller_balance_insufficient');
  assert.equal(h.calls.length, 0);
});
test('ambiguous provider/network failure retains reservation and cannot assert no money moved', async () => {
  const h = harness('reversal', { details: { transfer_id: 'tr_seller_a' } });
  h.stripe.transfers.createReversal = async () => { throw new Error('uncertain outcome'); };
  await assert.rejects(executePaymentOperation('op-1', h.admin, h.stripe)); assert.equal(h.settlements.length, 0);
});
test('database write failure after Stripe success retries exact parameters and key', async () => {
  const h = harness('refund'); let fail = true;
  h.admin.rpc = async (name, args) => {
    if (name === 'claim_payment_operation') return { data: h.op, error: null };
    if (fail) return { error: { code: 'local-failure' } };
    h.settlements.push(args); return { error: null };
  };
  await assert.rejects(executePaymentOperation('op-1', h.admin, h.stripe)); fail = false;
  await executePaymentOperation('op-1', h.admin, h.stripe);
  assert.deepEqual(h.calls[0], h.calls[1]); assert.equal(h.settlements.length, 1);
});
test('unclaimed or expired-horizon operation makes zero provider mutations', async () => {
  const h = harness('refund'); h.admin.rpc = async () => ({ data: null, error: null });
  assert.equal(await executePaymentOperation('op-1', h.admin, h.stripe), 'held'); assert.equal(h.calls.length, 0);
});
test('refund evidence from the wrong payment cannot settle an allocation', async () => {
  const h = harness('refund'); h.stripe.refunds.create = async p => ({ id: 're_wrong', ...p, payment_intent: 'pi_another_seller', currency: 'gbp', status: 'succeeded' });
  await assert.rejects(executePaymentOperation('op-1', h.admin, h.stripe)); assert.equal(h.settlements.length, 0);
});
test('zero transfer after same-seller recovery settles without a Stripe zero-value request', async () => {
  const h = harness('transfer', { amount: 0 }); await executePaymentOperation('op-1', h.admin, h.stripe);
  assert.equal(h.calls.length, 0); assert.equal(h.settlements[0].p_status, 'succeeded');
});
function eventHarness() {
  const h = harness('refund', { stripe_id: 're_customer', status: 'pending' });
  const state = { event: 'pending', retrieved: 0, updates: [] };
  h.admin.from = table => {
    const query = {
      upsert: async () => ({ error: null }), select() { return query; }, eq() { return query; },
      update(values) { state.updates.push({ table, ...values }); if (values.state) state.event = values.state; return query; },
      then(resolve) { resolve({ error: null }); },
      single: async () => ({ data: table === 'payment_webhook_events' ? { state: state.event }
        : table === 'payment_operations' ? h.op : table === 'seller_allocations' ? { order_id: 'order-1' } : { payment_intent_id: 'pi_customer' }, error: null }),
    }; return query;
  };
  h.stripe.refunds.retrieve = async () => { state.retrieved++; return { id: 're_customer', amount: 950, currency: 'gbp', payment_intent: 'pi_customer', status: 'succeeded', metadata: { holyhub_operation_id: 'op-1' } }; };
  return { ...h, state };
}
test('duplicate financial webhook acknowledges once; late event fetches current provider state', async () => {
  const h = eventHarness(); const event = { id: 'evt_repeat', type: 'refund.updated', data: { object: { id: 're_customer', object: 'refund', status: 'pending', metadata: { holyhub_operation_id: 'op-1' } } } };
  await processFinancialWebhook(event, h.admin, h.stripe); await processFinancialWebhook(event, h.admin, h.stripe);
  assert.equal(h.settlements.length, 1); assert.equal(h.settlements[0].p_status, 'succeeded'); assert.equal(h.state.retrieved, 1);
});
test('reconciliation finds provider refund after lost DB acknowledgement without creating another refund', async () => {
  const h = eventHarness(); h.op.stripe_id = null;
  h.stripe.refunds.list = () => ({ autoPagingEach: async callback => callback(await h.stripe.refunds.retrieve()) });
  await reconcilePaymentOperation('op-1', h.admin, h.stripe);
  assert.equal(h.calls.length, 0); assert.equal(h.settlements[0].p_stripe_id, 're_customer');
});
test('zero-value cancellation settles its stock adjustment without creating a Stripe refund', async () => {
  const h = harness('refund', { amount: 0, payment_intent_id: null });
  await executePaymentOperation('op-1', h.admin, h.stripe); assert.equal(h.calls.length, 0); assert.equal(h.settlements[0].p_status, 'succeeded');
});
test('external transfer reversal with the original transfer metadata still creates a reconciliation hold', async () => {
  const h = eventHarness(); h.op.kind = 'transfer'; h.op.stripe_id = 'tr_seller_a'; h.op.details = { destination: 'acct_seller_a', charge: 'ch_platform' };
  h.stripe.transfers.retrieve = async () => ({ id: 'tr_seller_a', object: 'transfer', amount: 950, currency: 'gbp', destination: 'acct_seller_a', source_transaction: 'ch_platform', amount_reversed: 100, metadata: { holyhub_operation_id: 'op-1' } });
  await processFinancialWebhook({ id: 'evt_external_reversal', type: 'transfer.reversed', data: { object: { id: 'tr_seller_a', object: 'transfer', metadata: { holyhub_operation_id: 'op-1' } } } }, h.admin, h.stripe);
  assert.equal(h.state.event, 'attention');
  assert.ok(h.state.updates.some(x => x.table === 'platform_payments' && x.reconciliation_hold === true));
});
test('admin financial mutations require the existing admin role before opening privileged clients', async () => {
  let privileged = 0;
  const { managePayments } = loadTypescript('app/admin/payments/actions.ts', {
    '@/lib/auth/require-user': { requireRole: async role => { assert.equal(role, 'admin'); throw new Error('denied'); } },
    '@/lib/supabase/admin': { createAdminClient: () => { privileged++; throw new Error('must not run'); } },
    '@/lib/stripe': { getStripe: () => { privileged++; throw new Error('must not run'); } },
    '@/lib/payment-operations': {},
    'next/cache': {}, 'next/navigation': {},
  });
  await assert.rejects(managePayments(new FormData()), /denied/); assert.equal(privileged, 0);
});

const feeDetails={destination:'acct_seller_a',credit_id:'credit-a',refund_operation_id:'refund-a',policy_version:1,funding:'holyhub'};
function creditHarness() {
  const h=harness('fee_credit_transfer',{amount:19,stripe_id:null,details:{...feeDetails}});
  const state={status:'queued',credit:'payable',provider:null,creates:0,ackLost:false};
  h.admin.rpc=async(name,args)=> {
    if(name==='claim_payment_operation') {
      if(state.status!=='queued') return {data:null,error:null};
      state.status='running'; state.credit='paying'; return {data:h.op,error:null};
    }
    h.settlements.push(args);
    if(args.p_status==='succeeded') {
      if(state.ackLost) return {error:{message:'Lost acknowledgement'}};
      state.status='succeeded'; state.credit='paid';
    } else {state.status='attention';state.credit='attention';}
    return {data:null,error:null};
  };
  h.stripe.transfers.create=async(params,options)=> {
    h.calls.push({params,options}); state.creates++;
    state.provider={id:'tr_fee_credit',...params,source_transaction:null}; return state.provider;
  };
  h.admin.from=table=> {
    const query={select(){return query;},eq(){return query;},
      single:async()=>({data:table==='payment_operations'?{...h.op,status:state.status}:table==='seller_allocations'?{order_id:'order-1'}:{payment_intent_id:'pi_customer'},error:null})};
    return query;
  };
  h.stripe.transfers.list=()=>({autoPagingEach:async cb=>{if(state.provider)await cb(state.provider);}});
  return {...h,state};
}
test('A113 fee credit creates once with frozen amount, distinct metadata and HolyHub platform funding',async()=>{
  const h=creditHarness(); await executePaymentOperation('op-1',h.admin,h.stripe);
  assert.equal(h.state.credit,'paid'); assert.equal(h.state.creates,1);
  assert.equal(await executePaymentOperation('op-1',h.admin,h.stripe),'held'); assert.equal(h.state.creates,1);
  const {params,options}=h.calls[0]; assert.equal(params.amount,19); assert.equal(params.destination,'acct_seller_a');
  assert.equal(params.source_transaction,undefined); assert.equal(options.idempotencyKey,'holyhub:c11:op-1');
  assert.deepEqual(JSON.parse(JSON.stringify(params.metadata)),{holyhub_operation_id:'op-1',holyhub_allocation_id:'alloc-a',holyhub_kind:'fee_credit_transfer',
    holyhub_refund_operation_id:'refund-a',holyhub_credit_id:'credit-a',holyhub_policy_version:'1'});
});
test('A113 lost acknowledgement holds retry then reconciles original transfer without second create',async()=>{
  const h=creditHarness();h.state.ackLost=true;
  await assert.rejects(executePaymentOperation('op-1',h.admin,h.stripe));
  assert.equal(h.state.credit,'attention'); assert.equal(await executePaymentOperation('op-1',h.admin,h.stripe),'held');
  h.state.ackLost=false; await reconcilePaymentOperation('op-1',h.admin,h.stripe);
  assert.equal(h.state.credit,'paid');assert.equal(h.state.creates,1);
  assert.equal(h.calls[0].options.idempotencyKey,'holyhub:c11:op-1');
});
test('A113 unknown provider outcome remains attention with no blind retry or seller debt',async()=>{
  const h=creditHarness();h.stripe.transfers.create=async()=>{h.state.creates++;throw new Error('timeout');};
  await assert.rejects(executePaymentOperation('op-1',h.admin,h.stripe));
  assert.equal(h.state.credit,'attention'); assert.equal(await executePaymentOperation('op-1',h.admin,h.stripe),'held');
  await reconcilePaymentOperation('op-1',h.admin,h.stripe);assert.equal(h.state.credit,'attention');assert.equal(h.state.creates,1);
  assert.equal(h.settlements[0].p_failure_code,'credit_outcome_requires_reconciliation');
});
test('A113 provider insufficient funds never enters seller debt path',async()=>{
  const h=creditHarness();h.stripe.transfers.create=async()=>{throw new Stripe.errors.StripeInvalidRequestError({message:'Unavailable',code:'balance_insufficient'});};
  await assert.rejects(executePaymentOperation('op-1',h.admin,h.stripe));assert.equal(h.state.credit,'attention');
  assert.equal(h.settlements[0].p_status,'failed');assert.notEqual(h.settlements[0].p_failure_code,'seller_balance_insufficient');
});
test('A113 unavailable destination makes no transfer and preserves outstanding attention',async()=>{
  const h=creditHarness();h.stripe.accounts.retrieve=async()=>({capabilities:{transfers:'inactive'}});
  await assert.rejects(executePaymentOperation('op-1',h.admin,h.stripe));assert.equal(h.state.creates,0);assert.equal(h.state.credit,'attention');
});
test('A113 reconciliation rejects another seller or sale transfer masquerading as credit',async()=>{
  for(const mismatch of [{destination:'acct_seller_b'},{amount:20},{source_transaction:'ch_sale'},
    {metadata:{holyhub_operation_id:'op-1',holyhub_kind:'transfer'}}]) {
    const h=creditHarness();await executePaymentOperation('op-1',h.admin,h.stripe);Object.assign(h.state.provider,mismatch);
    await assert.rejects(reconcilePaymentOperation('op-1',h.admin,h.stripe));
    assert.equal(h.state.creates,1);
  }
});
test('A113 duplicate and stale credit webhooks fetch current transfer and bypass sale recovery',async()=>{
  const h=eventHarness();h.op.kind='fee_credit_transfer';h.op.details={...feeDetails};h.op.amount=19;
  const transfer={id:'tr_fee',amount:19,currency:'gbp',destination:'acct_seller_a',source_transaction:null,amount_reversed:0,
    metadata:{holyhub_operation_id:'op-1',holyhub_allocation_id:'alloc-a',holyhub_kind:'fee_credit_transfer',
      holyhub_refund_operation_id:'refund-a',holyhub_credit_id:'credit-a',holyhub_policy_version:'1'}};
  let reads=0;h.stripe.transfers.retrieve=async()=>{reads++;return transfer;};
  const event={id:'evt_fee',type:'transfer.created',data:{object:transfer}};
  await processFinancialWebhook(event,h.admin,h.stripe);await processFinancialWebhook(event,h.admin,h.stripe);
  assert.equal(reads,1);assert.equal(h.settlements.length,1);assert.equal(h.settlements[0].p_status,'succeeded');
  h.state.event='pending';await processFinancialWebhook({...event,id:'evt_fee_stale',data:{object:{...transfer,amount:0}}},h.admin,h.stripe);
  assert.equal(h.settlements[1].p_status,'succeeded');assert.equal(h.settlements[1].p_amount,19);
  assert.equal(h.calls.length,0);
});
test('A113 queue discovers fee-delayed successful refunds separately from accounted refunds',async()=>{
  const h=creditHarness();const rpc=h.admin.rpc;let recognitionCalls=0;
  h.admin.rpc=async(name,args)=>{
    if(name==='reserve_processing_fee_credit') {recognitionCalls++;assert.equal(args.p_refund_operation_id,'refund-a');return {data:'credit-a',error:null};}
    return rpc(name,args);
  };
  h.admin.from=table=>{
    const filters={};const query={select(){return query;},eq(k,v){filters[k]=v;return query;},
      in(k,v){filters[k]=v;return query;},is(){return query;},not(){return query;},order(){return query;},
      range:async()=>({data:table==='payment_operations' && filters.processing_fee_credit_policy_version?.includes(2) ? [{id:'refund-a'}]
        :table==='payment_operations' && filters.status?.includes('queued') ? [{id:'op-1'}]:[],error:null})};return query;
  };
  const result=await runPaymentQueue(h.admin,h.stripe);assert.equal(result.errors,0);assert.equal(result.processed,1);
  assert.equal(recognitionCalls,1);assert.equal(h.state.credit,'paid');assert.equal(h.state.creates,1);
});

async function adminRefund(share,extra={}) {
  const calls=[];let hydrated=0;
  const {managePayments}=loadTypescript('app/admin/payments/actions.ts',{
    '@/lib/auth/require-user':{requireRole:async()=>({user:{id:'admin-reviewer'}})},
    '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{order_id:'order-a'},error:null})}),
      rpc:async(name,args)=>{calls.push({name,args});return {data:'refund-a',error:null};}})},
    '@/lib/stripe':{getStripe(){throw new Error('No Stripe actions permitted');}},
    '@/lib/payment-operations':{hydratePaymentOrder:async()=>{hydrated++;}},
    'next/cache':{revalidatePath(){}},'next/navigation':{redirect:url=>{throw new Error(url);}},
  });
  const data=new FormData();
  for(const [k,v] of Object.entries({action:'refund',verified:'yes',seller_order_id:'seller-a',responsibility:'seller',delivery:'0',reason:'Verified shared cause',request_key:'case-a',item_amount_item:'6.00',...extra}))data.set(k,v);
  if(share!==undefined)data.set('fee_responsibility_bps',share);
  let result;try{await managePayments(data);}catch(error){result=error.message;}
  return {calls,hydrated,result};
}
test('A138 admin rejects missing, fractional, signed, exponential and out-of-range fee shares before hydration',async()=>{
  for(const share of [undefined,'','-1','10001','1.5','1e3','+5000','NaN']){
    const h=await adminRefund(share);assert.equal(h.calls.length,0);assert.equal(h.hydrated,0);assert.match(h.result,/error=/);
  }
});
test('A138 admin passes explicit independent fee share with unchanged customer amount and seller liability',async()=>{
  for(const share of ['0','5000','10000']){
    const h=await adminRefund(share);assert.match(h.result,/message=/);assert.equal(h.calls.length,1);
    const {args}=h.calls[0];assert.equal(args.p_fee_responsibility_bps,Number(share));assert.equal(args.p_seller_responsible,true);
    assert.equal(args.p_lines[0].amount,600);assert.equal(args.p_delivery,0);
  }
});
test('A138 worker preserves policy version 2 metadata and durable payment identity',async()=>{
  const h=creditHarness();h.op.details.policy_version=2;
  await executePaymentOperation('op-1',h.admin,h.stripe);
  assert.equal(h.calls[0].params.metadata.holyhub_policy_version,'2');
  assert.equal(h.calls[0].options.idempotencyKey,'holyhub:c11:op-1');assert.equal(h.state.creates,1);
});
test('A138 admin records verified provider reimbursement evidence without financial execution',async()=>{
  const h=await adminRefund(undefined,{action:'rebate',refund_operation_id:'refund-a',provider_reference:'re_fee_a',rebate_amount:'0.10',evidence:'Provider transaction evidence'});
  assert.match(h.result,/message=/);assert.equal(h.hydrated,0);assert.equal(h.calls[0].name,'record_processing_fee_reimbursement');
  assert.equal(h.calls[0].args.p_amount,10);assert.equal(h.calls[0].args.p_verified_by,'admin-reviewer');
  for(const amount of ['0','-1','invalid']){
    const bad=await adminRefund(undefined,{action:'rebate',rebate_amount:amount});assert.equal(bad.calls.length,0);assert.match(bad.result,/error=/);
  }
});
