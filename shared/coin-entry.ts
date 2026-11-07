export const ENTRY_FEES=[100,500,1000,2500] as const;
export type EntryFee=typeof ENTRY_FEES[number];
export const isEntryFee=(value:unknown):value is EntryFee=>ENTRY_FEES.some(fee=>fee===value);
export const isQueueFee=(value:unknown):value is EntryFee|0=>value===0||isEntryFee(value);
export type EntryReceipt={id:string;matchId:string;amount:number};
