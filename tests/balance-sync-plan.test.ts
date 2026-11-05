import {expect,it,vi} from 'vitest';
import {balanceSyncStep,newBalanceSync,balanceSyncView,BALANCE_QUERY,type BalanceSyncState} from '@/lib/gmail/balance-sync-plan';
const now=Date.UTC(2026,10,1),point={account:'Fortuneo · Courant',date:'2026-10-30',balance:1000};
const source=()=>({list:vi.fn().mockResolvedValue({ids:['mail']}),read:vi.fn().mockResolvedValue([point,{...point,account:'Banque B · Livret',balance:50}])});
it('queries both historical subjects and discovers the earliest week without downloading every daily email',async()=>{
 expect(BALANCE_QUERY).toContain('Vos soldes quotidiens');expect(BALANCE_QUERY).toContain('Balance quotidienne');
 const mail=source();let state=newBalanceSync(now);
 mail.list.mockImplementation(async(q:string)=>({ids:Number(q.match(/before:(\d+)/)?.[1])*1000>Date.UTC(2025,0,1)?['mail']:[]}));
 for(let i=0;i<20&&state.phase==='discover';i++)state=await balanceSyncStep(state,mail,now);
 expect(state.phase).toBe('backfill');expect(mail.read).not.toHaveBeenCalled();expect(state.high-state.low).toBeLessThanOrEqual(86400000);
});
it('checkpoints one selected email per week, stores every bank, and returns only Fortuneo',async()=>{
 const mail=source();let state={...newBalanceSync(now),phase:'backfill' as const,low:Date.UTC(2026,9,20)};
 const listed=await balanceSyncStep(state,mail,now);expect(mail.list).toHaveBeenCalledWith(expect.stringContaining('before:'),1);expect(mail.read).not.toHaveBeenCalled();
 const loaded=await balanceSyncStep(listed,mail,now);expect(loaded.points).toHaveLength(2);expect(loaded.weeks).toBe(1);expect(balanceSyncView(loaded).points).toEqual([point]);
 // Simulated reload resumes the serialized state, not the first request.
 await balanceSyncStep(JSON.parse(JSON.stringify(loaded)),mail,now);expect(mail.read).toHaveBeenCalledOnce();
});
it('does not advance the checkpoint when Google refuses a read',async()=>{
 const mail=source();mail.read.mockRejectedValue({response:{status:403}});
 const state={...newBalanceSync(now),phase:'backfill' as const,incremental:{startedAt:now,pending:['blocked'],listed:true}};
 const before=JSON.stringify(state);await expect(balanceSyncStep(state,mail,now)).rejects.toEqual({response:{status:403}});expect(JSON.stringify(state)).toBe(before);expect(mail.read).toHaveBeenCalledOnce();
});
it('incremental collection fetches only unseen message IDs and advances watermark after all pages',async()=>{
 const mail=source();mail.list.mockResolvedValue({ids:['known','new']});
 let state:BalanceSyncState={...newBalanceSync(now),phase:'incremental',messages:['known']};
 state=await balanceSyncStep(state,mail,now+1000);expect(state.incremental?.pending).toEqual(['new']);
 state=await balanceSyncStep(state,mail,now+1000);expect(mail.read).toHaveBeenCalledWith('new');expect(state.checkedAt).toBe(now);
 state=await balanceSyncStep(state,mail,now+1000);expect(state.checkedAt).toBe(now+1000);expect(state.incremental).toBeNull();
});
it('a persisted pause prevents any Gmail call',async()=>{const mail=source();await expect(balanceSyncStep({...newBalanceSync(now),pauseUntil:now+1000},mail,now)).rejects.toThrow();expect(mail.list).not.toHaveBeenCalled();});

it('loads the latest balance before an unfinished backfill without resetting its cursor',async()=>{
 const {latestBalanceSyncStep,BALANCE_QUERY}=await import('@/lib/gmail/balance-sync-plan');const mail=source();mail.list.mockResolvedValue({ids:['latest']});
 const initial={...newBalanceSync(now),phase:'backfill' as const,weekEnd:Date.UTC(2020,1,1),messages:['older']};
 const updated=await latestBalanceSyncStep(initial,mail,now);expect(mail.list).toHaveBeenCalledWith(BALANCE_QUERY,1);expect(mail.read).toHaveBeenCalledWith('latest');expect(updated.messages).toEqual(['older','latest']);expect(updated.weekEnd).toBe(initial.weekEnd);expect(updated.phase).toBe('backfill');expect(initial.messages).toEqual(['older']);
 await latestBalanceSyncStep(updated,mail,now);expect(mail.read).toHaveBeenCalledTimes(1);
});
it('does not skip refusals or consume quota while the latest-balance check is paused',async()=>{
 const {latestBalanceSyncStep}=await import('@/lib/gmail/balance-sync-plan');const mail=source();const initial=newBalanceSync(now);
 await expect(latestBalanceSyncStep({...initial,pauseUntil:now+1},mail,now)).rejects.toThrow();expect(mail.list).not.toHaveBeenCalled();
 mail.read.mockRejectedValue({response:{status:403}});await expect(latestBalanceSyncStep(initial,mail,now)).rejects.toEqual({response:{status:403}});expect(initial.messages).toEqual([]);expect(mail.list).toHaveBeenCalledTimes(1);expect(mail.read).toHaveBeenCalledTimes(1);
});
