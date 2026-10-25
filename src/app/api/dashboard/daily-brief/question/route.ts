import { z } from "zod";
import { GET as getDailyBrief } from "../route";
import { requireSameOrigin, privateResponseHeaders } from "@/lib/security/http";
import { answerBriefQuestion, BriefQuestionError, type QuestionBrief } from "@/lib/daily-brief-question";
export const maxDuration=60;
const schema=z.object({question:z.string().trim().min(2).max(2000),views:z.array(z.enum(["essential","secondary","travel"])).max(3).optional(),history:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(4000)}).strict()).max(6).default([])}).strict();
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:privateResponseHeaders});
export async function POST(request:Request){
 const forbidden=requireSameOrigin(request);if(forbidden)return forbidden;
 if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"Format de question invalide."},415);
 const reader=request.body?.getReader();if(!reader)return json({error:"Question manquante."},400);
 let bytes=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>32768){await reader.cancel();return json({error:"Question trop longue."},413);}chunks.push(value);}}catch{return json({error:"Lecture de la question interrompue."},400);}
 const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
 let payload:unknown;try{payload=JSON.parse(new TextDecoder().decode(buffer));}catch{return json({error:"Question invalide."},400);}
 const parsed=schema.safeParse(payload);if(!parsed.success)return json({error:"Écrivez une question de 2 à 2 000 caractères."},400);
 // Reuses the authenticated, owner-scoped, read-only first-party summary. The model gets no database access.
 const summaryUrl=new URL(request.url);summaryUrl.pathname=summaryUrl.pathname.replace(/\/question\/?$/,"");summaryUrl.search="";summaryUrl.searchParams.set("assistantContext","1");if(parsed.data.views)summaryUrl.searchParams.set("views",parsed.data.views.join(","));
 const summary=await getDailyBrief(new Request(summaryUrl));
 if(!summary.ok)return summary;
 const brief=await summary.json() as QuestionBrief;
 try{return json({answer:await answerBriefQuestion(parsed.data.question,brief,parsed.data.history,{signal:request.signal}),asOf:brief.date});}
 catch(error){if(error instanceof BriefQuestionError)return json({error:error.message},error.status);return json({error:"L’analyse est temporairement indisponible. Réessayez."},502);}
}
