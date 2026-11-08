import {AVATAR_CATALOG,COSMETIC_CATALOG} from '../shared/cosmetics';
export type StoreTier='starter'|'rare'|'legendary';
const PRICES:Readonly<Record<string,{price:number;tier:StoreTier}>>={
 djellaba:{price:3000,tier:'starter'},sport:{price:5000,tier:'starter'},
 amazigh:{price:15000,tier:'rare'},astronaut:{price:18000,tier:'rare'},ninja:{price:30000,tier:'rare'},king:{price:80000,tier:'legendary'},
 mosaic_frame:{price:2500,tier:'starter'},atlas_frame:{price:15000,tier:'rare'},aurora_frame:{price:25000,tier:'rare'},
 marrakech_bg:{price:4000,tier:'starter'},atlas_night_bg:{price:18000,tier:'rare'},zellige_bg:{price:25000,tier:'rare'},
 calligraphy_plate:{price:2000,tier:'starter'},gold_plate:{price:15000,tier:'rare'},emerald_plate:{price:20000,tier:'rare'},
 starlight:{price:5000,tier:'starter'},confetti:{price:18000,tier:'rare'},golden_burst:{price:60000,tier:'legendary'},
 ramadan_lantern:{price:20000,tier:'rare'},eid_mosaic:{price:22000,tier:'rare'},atlas_winter:{price:30000,tier:'rare'},
};
export const STORE_TIER_LABELS={starter:'عادي',rare:'نادر',legendary:'أسطوري'} as const;
export function getStoreOffer(id:string){
 const legacy=[...AVATAR_CATALOG,...COSMETIC_CATALOG].find(item=>item.id===id);
 if(!legacy)return undefined;
 const offer=legacy.price===0?{price:0,tier:'starter' as const}:PRICES[id];
 // Fail closed: an incomplete configuration must never silently retain a cheap price.
 if(!offer)return undefined;
 return {...offer,purchaseReady:offer.price===legacy.price};
}
export function canPurchaseStoreOffer(id:string,quotedPrice:number,authoritativePrice?:number){
 const offer=getStoreOffer(id);
 return !!offer&&quotedPrice===offer.price&&(offer.price===0||authoritativePrice===offer.price);
}
