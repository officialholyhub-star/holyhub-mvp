import test from 'node:test';
import assert from 'node:assert/strict';
import {poundsToPence,validateProduct} from '../lib/marketplace.ts';
test('prices use integer pence; invalid decimals and forged status are rejected or ignored',()=>{
 assert.equal(poundsToPence('19.99'),1999);assert.equal(poundsToPence('0.20'),20);
 for(const value of ['1.001','1e3','-1','Infinity',null,2,'1000000.01'])assert.equal(poundsToPence(value),null);
 const form=new FormData();for(const [k,v] of Object.entries({name:'Hope print',description:'A thoughtful print to brighten your home.',category:'Art & Prints',price:'19.99',stock:'4',delivery_info:'Delivery details will be confirmed.',status:'published',business_id:'forged',commission_bps:'0'}))form.set(k,v);
 const result=validateProduct(form);assert.equal(result.error,undefined);assert.equal(result.data.price_pence,1999);assert.equal(Object.hasOwn(result.data,'status'),false);assert.equal(Object.hasOwn(result.data,'business_id'),false);
 form.set('stock','1.5');assert.match(validateProduct(form).error,/whole stock/);
});
