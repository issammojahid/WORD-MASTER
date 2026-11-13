import {useEffect,useSyncExternalStore} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY="@horof_interface_2027";
type Preferences={reduceMotion:boolean;quality:"auto"|"low"};
let value:Preferences={reduceMotion:false,quality:"auto"};
let hydration:Promise<void>|undefined;
let revision=0;
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
function hydrate(){return hydration??=(async()=>{const before=revision;try{const saved=JSON.parse(await AsyncStorage.getItem(KEY)??"null");if(saved&&revision===before){value={reduceMotion:saved.reduceMotion===true,quality:saved.quality==="low"?"low":"auto"};listeners.forEach(listener=>listener());}}catch{/* Keep accessible defaults if saved preferences are unavailable. */}})();}
export function setInterfacePreferences(patch:Partial<Preferences>){revision++;value={...value,...patch};listeners.forEach(listener=>listener());void AsyncStorage.setItem(KEY,JSON.stringify(value)).catch(()=>{});}
export function useInterfacePreferences(){useEffect(()=>{void hydrate();},[]);return useSyncExternalStore(subscribe,()=>value,()=>value);}
