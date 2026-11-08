import React,{useState} from 'react';
import {Pressable,View} from 'react-native';
import {ScaledText as Text} from './ScaledText';
import {RoyalSurface} from './RoyalUi';

const topics=[
 {title:'كيف ألعب؟',body:'في كل جولة يظهر حرف. اكتب إجابة تبدأ بهذا الحرف لكل فئة، ثم أرسل إجاباتك قبل انتهاء الوقت. زر «التالي» في لوحة المفاتيح ينقلك إلى الخانة التالية. يمكنك ترك خانة لا تعرف إجابتها فارغة.'},
 {title:'ما الفرق بين الأوضاع؟',body:'دون اتصال: لعب فردي. أونلاين فردي: لاعب ضد لاعب. فرق: أربعة لاعبين في فريقين، اثنان ضد اثنين. أربعة لاعبين: كل لاعب ينافس لحسابه. غرفة الأصدقاء: إنشاء غرفة خاصة أو الانضمام إليها برمز، وفق إعدادات المضيف.'},
 {title:'كيف أختار مظهري؟',body:'افتح المتجر واختر فئة، ثم اضغط على عنصر لمعاينته. العنصر المملوك يمكن تجهيزه. شراء عنصر غير مملوك يمر عبر نافذة تأكيد. العناصر المكتوب عليها «معاينة فقط» أو «قريباً» ليست متاحة للشراء أو الاستلام.'},
 {title:'كيف ألعب مع أصدقائي؟',body:'اختر غرفة الأصدقاء من الرئيسية. أنشئ غرفة وشارك رمزها، أو أدخل رمز غرفة صديقك. انتظر انضمام اللاعبين واضغط «أنا مستعد». المضيف يبدأ المباراة عندما تسمح حالة الغرفة بذلك. أيقونتا الميكروفون والرسائل السريعة في أعلى قاعة الانتظار.'},
 {title:'لماذا لا تبدأ مباراة عبر الإنترنت؟',body:'تأكد من الاتصال، ومن توفر مبلغ الدخول المختار في رصيدك. الغرف الخاصة والأوضاع العامة لها قواعد مختلفة. عند ظهور رسالة خطأ، أعد المحاولة من داخل اللعبة. لا تحذف بيانات التطبيق لحل مشكلة الاتصال، فقد تفقد بيانات محفوظة على جهازك.'},
 {title:'كيف أضبط القراءة والحركة؟',body:'من الإعدادات يمكنك تكبير النص، وتقليل الحركة، واختيار جودة رسوم منخفضة. إعداد تقليل الحركة في جهازك يُحترم أيضاً. في الشاشات الصغيرة مرّر الصفحة للوصول إلى بقية المحتوى.'},
];

export function PlayingGuide(){
 const [expanded,setExpanded]=useState<number|null>(0);
 return <View style={{gap:9}}>{topics.map((topic,index)=><RoyalSurface key={topic.title} style={{padding:11,gap:8}}>
  <Pressable accessibilityRole="button" accessibilityLabel={topic.title} accessibilityState={{expanded:expanded===index}} onPress={()=>setExpanded(expanded===index?null:index)} style={{minHeight:44,justifyContent:'center'}}>
   <Text style={{fontFamily:'Cairo_700Bold',fontSize:14,color:'#FFE3A6',textAlign:'right'}}>{expanded===index?'−':'+'}　{topic.title}</Text>
  </Pressable>
  {expanded===index?<Text style={{fontFamily:'Cairo_400Regular',fontSize:13,lineHeight:25,color:'#E2D8EF',textAlign:'right'}}>{topic.body}</Text>:null}
 </RoyalSurface>)}</View>;
}
