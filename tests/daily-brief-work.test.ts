import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {loadDailyBriefWork} from '@/lib/supabase/daily-brief-work';
it('loads all work history in pages, including dates before 2023',async()=>{
 const ranges:number[]=[];
 const days=Array.from({length:501},(_,index)=>({work_date:index===0?'2022-01-03':'2024-01-03'}));
 const client={from:(table:string)=>{const query={select:()=>query,eq:()=>query,lte:()=>query,order:()=>query,range:async(start:number,end:number)=>{if(table==='billable_work_days')ranges.push(start);return {data:table==='billable_work_days'?days.slice(start,end+1):[],error:null};},maybeSingle:async()=>({data:{tjm_ht:1000},error:null})};return query;}};
 const result=await loadDailyBriefWork(client as never,'synthetic-owner','2026-11-07');
 expect(ranges).toEqual([0,500]);expect(result.days).toHaveLength(501);expect(result.days[0]).toBe('2022-01-03');
});
it('stops on a refused history query without returning partial data',async()=>{
 const range=vi.fn().mockResolvedValue({data:null,error:{code:'42501'}});
 const client={from:()=>{const query={select:()=>query,eq:()=>query,lte:()=>query,order:()=>query,range,maybeSingle:async()=>({data:null,error:null})};return query;}};
 await expect(loadDailyBriefWork(client as never,'synthetic-owner','2026-11-07')).rejects.toThrow('Activity unavailable');
 expect(range).toHaveBeenCalledTimes(2);
});
