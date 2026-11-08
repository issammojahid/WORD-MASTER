import test from 'node:test';
import assert from 'node:assert/strict';
import {AVATAR_CATALOG,COSMETIC_CATALOG} from '../shared/cosmetics';
import {getStoreOffer,canPurchaseStoreOffer} from '../constants/store-economy';
test('every existing store item has a tier, free defaults stay free, and changed quotes cannot reach purchase',()=>{
 for(const item of [...AVATAR_CATALOG,...COSMETIC_CATALOG]){
  const offer=getStoreOffer(item.id);assert.ok(offer,item.id);
  assert.ok(Number.isSafeInteger(offer.price));
  if(item.price===0){assert.equal(offer.price,0);assert.equal(canPurchaseStoreOffer(item.id,0),true);}
  else{
   const range=offer.tier==='starter'?[2000,5000]:offer.tier==='rare'?[15000,30000]:[60000,100000];
   assert.ok(offer.price>=range[0]&&offer.price<=range[1],item.id);
   assert.equal(offer.purchaseReady,false);assert.equal(canPurchaseStoreOffer(item.id,offer.price),false);assert.equal(canPurchaseStoreOffer(item.id,item.price),false);
  }
 }
 assert.equal(getStoreOffer('unknown-item'),undefined);
 assert.equal(canPurchaseStoreOffer('unknown-item',0),false);
 assert.equal(canPurchaseStoreOffer('student',3000),false);
});
