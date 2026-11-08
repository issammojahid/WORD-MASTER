import {useIsFocused} from "@react-navigation/native";
import {useEffect,useRef} from 'react';
import {useLanguage} from '@/contexts/LanguageContext';
import {useAppActive} from './use-app-active';
import {playSound,stopSound} from './sound-manager';
import type {MatchOutcome} from './match-outcome';

export function useResultSound(key:string|null,outcome:MatchOutcome|null){
 const {soundEffects,audioPreferencesReady}=useLanguage(),active=useAppActive(),focused=useIsFocused(),played=useRef<string|null>(null);
 useEffect(()=>{
  if(!key){played.current=null;return;}
  if(!audioPreferencesReady||!outcome)return;
  if(played.current===key)return;
  played.current=key;
  if(!soundEffects||!active||!focused)return;
  let allowed=true;
  void playSound(outcome,()=>allowed);
  return()=>{allowed=false;void stopSound(outcome);};
 },[key,outcome,soundEffects,audioPreferencesReady,active,focused]);
}
