import { CONSENT_STORAGE_KEY } from '@/lib/consent';
import { CONSENT_REGION_COOKIE } from '@/lib/consent-region';

/**
 * Inline Consent Mode v2 defaults — must run before GTM / gtag.js (no network).
 * `analytics_storage` follows a stored CMP choice first; without one it is
 * granted only in the `standard` consent region (cookie set by the proxy, see
 * `consent-region.ts`) and denied everywhere else, including when the cookie
 * is missing. Ad storage stays denied until the visitor opts in.
 */
export const CONSENT_MODE_DEFAULTS_SCRIPT = `
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
var atbAnalytics='denied';
try{
  var atbStored=JSON.parse(localStorage.getItem('${CONSENT_STORAGE_KEY}')||'null');
  if(atbStored&&typeof atbStored.analytics==='boolean'){atbAnalytics=atbStored.analytics?'granted':'denied';}
  else if(/(?:^|;\\s*)${CONSENT_REGION_COOKIE}=standard(?:;|$)/.test(document.cookie)){atbAnalytics='granted';}
}catch(e){}
gtag('consent','default',{
  analytics_storage:atbAnalytics,
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  wait_for_update:500
});
gtag('set','ads_data_redaction',true);
gtag('set','url_passthrough',true);
`.trim();
