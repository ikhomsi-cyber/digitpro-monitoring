import {it,expect} from 'vitest';
import {residenceGoal} from '@/lib/residence-goal';
it('adds Fortuneo and net PER and calculates the remaining 400k goal in cents',()=>{expect(residenceGoal(65000,77000)).toEqual({target:400000,total:142000,remaining:258000,percent:35.5});});
it('never presents missing savings as a complete zero balance',()=>{expect(residenceGoal(null,77000).total).toBeNull();expect(residenceGoal(65000,null).remaining).toBeNull();expect(residenceGoal(NaN,0).total).toBeNull();});
it('keeps an exceeded goal and clamps remaining capital to zero',()=>{expect(residenceGoal(350000,100000)).toMatchObject({total:450000,remaining:0,percent:112.5});});
