import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { suggestPlayerName } from "@shared/player-name";
export function PlayerNameForm({ onSaved }: { onSaved?: () => void }) {
  const { profile, setPlayerName } = usePlayer();
  const { theme } = useTheme();
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (busy) return;
    setBusy(true); setError("");
    try { await setPlayerName(name); onSaved?.(); }
    catch (e) { setError(e instanceof Error && e.message === "name_taken" ? "هذا الاسم مستخدم بالفعل، اختر اسماً آخر" : e instanceof Error && e.message === "invalid_name" ? "يجب أن يتكون الاسم من 2 إلى 20 حرفاً، ويُسمح بالحروف والأرقام والمسافات و _ و -" : "تعذر تأكيد الاسم. تحقق من اتصالك ثم أعد المحاولة."); }
    finally { setBusy(false); }
  }
  return <View style={s.form}>
    <Text style={[s.title, {color:theme.textPrimary}]}>اختر اسمك</Text>
    <Text style={[s.note, {color:theme.textSecondary}]}>يمكنك تغييره لاحقاً من ملفك الشخصي</Text>
    <TextInput accessibilityLabel="اسم اللاعب" value={name} onChangeText={setName} maxLength={20} editable={!busy} autoCapitalize="none" style={[s.input,{color:theme.inputText,backgroundColor:theme.inputBg,borderColor:theme.inputBorder}]} onSubmitEditing={() => void save()} />
    <Pressable disabled={busy} accessibilityRole="button" onPress={() => {setName(suggestPlayerName());setError("");}} style={s.button}><Text style={{color:theme.textPrimary}}>اقتراح اسم عشوائي 🎲</Text></Pressable>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <Pressable disabled={busy} accessibilityRole="button" onPress={() => void save()} style={[s.button,s.primary]}><Text style={s.save}>{busy ? "جارٍ التحقق…" : "حفظ الاسم"}</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({form:{gap:12,width:"100%"},title:{fontFamily:"Cairo_700Bold",fontSize:22,textAlign:"center"},note:{fontFamily:"Cairo_400Regular",textAlign:"center"},input:{minHeight:48,borderWidth:1,borderRadius:12,padding:10,textAlign:"center",fontSize:18},button:{minHeight:44,alignItems:"center",justifyContent:"center",padding:8,borderRadius:12},primary:{backgroundColor:"#F1CA76"},save:{fontFamily:"Cairo_700Bold",color:"#21152F"},error:{color:"#FFB8BE",textAlign:"center",fontFamily:"Cairo_400Regular"}});
