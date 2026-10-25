import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { answerBriefQuestion, briefQuestionContext, type QuestionBrief } from "@/lib/daily-brief-question";
import { buildDailyBrief } from "@/lib/daily-financial-brief";
const brief={...buildDailyBrief({date:"2026-10-25",transactions:[],snapshot:null}),qontoBalance:null,householdHistory:[]} as QuestionBrief;
afterEach(()=>vi.unstubAllEnvs());
it("sends only permitted aggregates with no stored response and no tools",async()=>{
 vi.stubEnv("OPENAI_API_KEY","synthetic-key");
 const fetcher=vi.fn().mockResolvedValue(Response.json({status:"completed",output:[{type:"message",content:[{type:"output_text",text:"Réponse synthétique."}]}]}));
 const result=await answerBriefQuestion("Mon CA progresse ?",brief,[],{fetcher});
 expect(result).toBe("Réponse synthétique.");expect(fetcher).toHaveBeenCalledOnce();
 const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.store).toBe(false);expect(body.tools).toBeUndefined();
 expect(JSON.stringify(briefQuestionContext(brief))).not.toContain("items");expect(body.input.at(-1)).toEqual({role:"user",content:"Mon CA progresse ?"});
});
it("does not transmit names, labels or recommendations outside the context allowlist",()=>{
 const context=briefQuestionContext({...brief,items:[{id:"secret-id",scope:"pro",priority:"info",title:"private-merchant",detail:"private-message",href:"/private",when:"Aujourd’hui"}]});
 expect(JSON.stringify(context)).not.toMatch(/private-merchant|private-message|secret-id/);
});
it("stops after one provider refusal, without exposing its response",async()=>{
 vi.stubEnv("OPENAI_API_KEY","synthetic-key");const fetcher=vi.fn().mockResolvedValue(Response.json({error:"private-provider-details"},{status:403}));
 await expect(answerBriefQuestion("Mon CA ?",brief,[],{fetcher})).rejects.toMatchObject({status:502});expect(fetcher).toHaveBeenCalledOnce();
});
it("does not contact a provider when no key is configured",async()=>{
 vi.stubEnv("OPENAI_API_KEY","");const fetcher=vi.fn();await expect(answerBriefQuestion("Mon CA ?",brief,[],{fetcher})).rejects.toMatchObject({status:503});expect(fetcher).not.toHaveBeenCalled();
});
it("does not present truncated model output as a complete analysis",async()=>{
 vi.stubEnv("OPENAI_API_KEY","synthetic-key");const fetcher=vi.fn().mockResolvedValue(Response.json({status:"incomplete",output:[{type:"message",content:[{type:"output_text",text:"incomplete"}]}]}));
 await expect(answerBriefQuestion("Mon CA ?",brief,[],{fetcher})).rejects.toMatchObject({status:502});
});
