import {expect,it} from 'vitest';
import {gmailReadError} from '@/lib/gmail/read-error';
it.each([['accessNotConfigured','api_disabled'],['insufficientPermissions','missing_scope'],['userRateLimitExceeded','quota'],['domainPolicy','organization_policy']])('classifies %s without leaking the provider response',(reason,expected)=>{
 const result=gmailReadError({response:{status:403,data:{error:{message:'private@example.test secret',errors:[{reason}]}}}});expect(result.reason).toBe(expected);expect(result.status).toBe(403);expect(JSON.stringify(result)).not.toContain('private@example');
});
it('keeps unknown refusals explicit instead of inventing a cause',()=>{expect(gmailReadError({response:{status:403}}).reason).toBe('forbidden');expect(gmailReadError({response:{status:401}}).reason).toBe('unauthorized');});
