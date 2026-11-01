import {it,expect,vi,beforeEach} from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({user:vi.fn(),mode:vi.fn(),from:vi.fn(),eq:vi.fn(),single:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({})}));
vi.mock('@/lib/supabase/config',()=>({getSupabaseRuntimeMode:()=> 'SUPABASE'}));
vi.mock('@/lib/dashboard-demo-preference',()=>({getDashboardEffectiveDataMode:m.mode}));
vi.mock('@/lib/supabase/server',()=>({createSupabaseServerClient:async()=>({auth:{getUser:m.user},from:m.from})}));
import {GET} from '@/app/api/dashboard/invest/route';
import {buildBankinPiloteSnapshot} from '@/lib/pilote';
beforeEach(()=>{vi.resetAllMocks();m.mode.mockReturnValue('SUPABASE');m.user.mockResolvedValue({data:{user:{id:'owner'}},error:null});m.eq.mockReturnValue({maybeSingle:m.single});m.from.mockReturnValue({select:()=>({eq:m.eq})});m.single.mockResolvedValue({data:null,error:null});});
it('requires an authenticated owner and never reads real data in demo mode',async()=>{m.user.mockResolvedValue({data:{user:null},error:null});expect((await GET()).status).toBe(401);expect(m.from).not.toHaveBeenCalled();m.mode.mockReturnValue('DEMO');expect((await GET()).status).toBe(403);expect(m.from).not.toHaveBeenCalled();});
it('selects only the owner snapshot, returns aggregates and disables shared caching',async()=>{
 const snapshot=buildBankinPiloteSnapshot([{date:'2024-11-14',amount:-30000,parentCategory:'Banque',subCategory:'Epargne',hidden:false,sourceRow:2,label:'Private label',identity:'opaque'}],'fixture','hash');m.single.mockResolvedValue({data:{snapshot},error:null});const response=await GET();const data=await response.json();expect(m.eq).toHaveBeenCalledWith('user_id','owner');expect(response.headers.get('cache-control')).toContain('no-store');expect(data.per.contributions).toBe(30000);expect(JSON.stringify(data)).not.toContain('Private label');expect(JSON.stringify(data)).not.toContain('opaque');
});
it('stops on database failure without exposing details or using another identity',async()=>{m.single.mockResolvedValue({data:null,error:{code:'42501',message:'private diagnostic'}});const response=await GET();expect(response.status).toBe(403);expect(await response.text()).not.toContain('private diagnostic');expect(m.from).toHaveBeenCalledOnce();});
