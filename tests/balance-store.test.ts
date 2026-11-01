import {vi,it,expect} from 'vitest';
vi.mock('server-only',()=>({}));
import {encodeBalanceState,decodeBalanceState,balanceMailboxKey} from '@/lib/gmail/balance-store';
import {newBalanceSync} from '@/lib/gmail/balance-sync-plan';
it('roundtrips durable progress without credentials or raw emails',()=>{const state=newBalanceSync(1000);state.messages=['opaque-message'];state.points=[{account:'Fortuneo',date:'2026-01-01',balance:123.45}];expect(decodeBalanceState(encodeBalanceState(state))).toEqual(state);expect(balanceMailboxKey(' A@example.test ')).toBe(balanceMailboxKey('a@example.test'));expect(balanceMailboxKey('b@example.test')).not.toBe(balanceMailboxKey('a@example.test'));});
it('rejects corrupt stored histories instead of overwriting them',()=>{expect(()=>decodeBalanceState({version:2,data:'bad'})).toThrow('conservées');});
