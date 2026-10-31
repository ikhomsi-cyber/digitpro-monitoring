/** Only allowlisted provider reasons leave the server; never expose Google's body. */
export function gmailReadError(error:unknown):{status:number;error:string;reason:string}{
 const value=error as {code?:unknown;response?:{status?:number;data?:{error?:{status?:string;errors?:{reason?:string}[];details?:{reason?:string}[]}}}};
 const status=value?.response?.status??(typeof value?.code==='number'?value.code:502);
 const provider=value?.response?.data?.error;
 const reasons=[provider?.status,...(provider?.errors??[]).map(e=>e.reason),...(provider?.details??[]).map(e=>e.reason)].filter(Boolean);
 if(reasons.some(r=>['accessNotConfigured','SERVICE_DISABLED'].includes(r!)))return {status:403,reason:'api_disabled',error:'L’API Gmail est désactivée dans le projet Google de DigitPro. Activez Gmail API dans Google Cloud, puis réessayez.'};
 if(reasons.some(r=>['insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'].includes(r!)))return {status:403,reason:'missing_scope',error:'Google n’a pas accordé la lecture des emails. Reconnectez ce compte depuis les paramètres DigitPro et autorisez la lecture Gmail.'};
 if(reasons.some(r=>['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded','RESOURCE_EXHAUSTED'].includes(r!)))return {status:status===403?403:429,reason:'quota',error:'Google limite temporairement la lecture Gmail. Chargement arrêté ; aucune relance automatique. Le délai dépend du quota concerné.'};
 if(reasons.some(r=>['domainPolicy','ORG_RESTRICTION_VIOLATION'].includes(r!)))return {status:403,reason:'organization_policy',error:'La politique Google Workspace bloque DigitPro. L’administrateur du compte doit autoriser l’application.'};
 if(status===401)return {status:401,reason:'unauthorized',error:'L’autorisation Gmail n’est plus valide. Reconnectez ce compte dans les paramètres DigitPro.'};
 if(status===403)return {status:403,reason:'forbidden',error:'Google refuse la lecture Gmail (403), sans cause reconnue. Vérifiez Gmail API et les permissions du projet Google DigitPro. Une connexion réussie ne garantit pas l’accès aux emails.'};
 return {status:502,reason:'unavailable',error:'Lecture des emails Bankin indisponible. Réessayez plus tard.'};
}
