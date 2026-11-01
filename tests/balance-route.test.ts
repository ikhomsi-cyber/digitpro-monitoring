import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({user:vi.fn(),gmail:vi.fn(),sync:vi.fn(),store:vi.fn(),load:vi.fn(),mode:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({})}));
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:async()=>({auth:{getUser:m.user}})}));
vi.mock('@/lib/supabase/config',()=>({getSupabaseRuntimeMode:()=> 'SUPABASE'}));
vi.mock('@/lib/dashboard-demo-preference',()=>({getDashboardEffectiveDataMode:m.mode}));
vi.mock('@/lib/gmail/tokens',()=>({withAuthorizedGmailClient:m.gmail}));
vi.mock('@/lib/gmail/balance-sync',()=>({balanceStoreForMailbox:m.store,syncBankinBalances:m.sync}));
import {GET,POST} from '@/app/api/gmail/bankin/balances/route';
import {newBalanceSync} from '@/lib/gmail/balance-sync-plan';
const request=(body:unknown={account:'secondary'},origin='https://digitpro.test')=>new Request('https://digitpro.test/api/gmail/bankin/balances',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();m.mode.mockReturnValue('SUPABASE');m.user.mockResolvedValue({data:{user:{id:'owner'}},error:null});m.store.mockResolvedValue({load:m.load});m.load.mockResolvedValue(null);m.gmail.mockImplementation((_c,_u,run)=>run({}));m.sync.mockResolvedValue({pending:false,points:[]});});
it('reads persisted Fortuneo data without connecting to Google or disclosing other banks',async()=>{
 const state=newBalanceSync();state.points=[{account:'Fortuneo · A',date:'2026-01-01',balance:10},{account:'Other · B',date:'2026-01-01',balance:5000}];m.load.mockResolvedValue({state});
 const response=await GET(new Request('https://digitpro.test/api/gmail/bankin/balances?account=secondary'));expect((await response.json()).points).toHaveLength(1);expect(response.headers.get('cache-control')).toContain('no-store');expect(m.store).toHaveBeenCalledWith(expect.anything(),'owner','secondary');expect(m.gmail).not.toHaveBeenCalled();
});
it('rejects unauthenticated, cross-origin, demo and forged mailbox input',async()=>{
 expect((await POST(request({},'https://attacker.test'))).status).toBe(403);
 expect((await POST(request({account:'secondary',cursor:'forged',userId:'victim'}))).status).toBe(400);
 m.user.mockResolvedValue({data:{user:null},error:null});expect((await POST(request())).status).toBe(401);
 m.mode.mockReturnValue('DEMO');expect((await GET(new Request('https://digitpro.test/api/gmail/bankin/balances'))).status).toBe(401);expect(m.gmail).not.toHaveBeenCalled();
});
it('does not call Google during a stored quota pause',async()=>{m.load.mockResolvedValue({state:{...newBalanceSync(),pauseUntil:Date.now()+60000,error:'pause'}});expect((await POST(request())).status).toBe(200);expect(m.gmail).not.toHaveBeenCalled();});
it('stops on 403 and never switches mailbox or leaks provider details',async()=>{m.sync.mockRejectedValue({response:{status:403,data:{error:{message:'secret private label',errors:[{reason:'userRateLimitExceeded'}]}}}});const result=await POST(request());expect(result.status).toBe(403);expect(m.gmail).toHaveBeenCalledOnce();expect(m.gmail).toHaveBeenCalledWith(expect.anything(),'owner',expect.any(Function),'secondary');expect(JSON.stringify(await result.json())).not.toContain('secret');});
