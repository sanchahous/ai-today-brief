import { CONSENT_STORAGE_KEY } from '@/lib/consent';

/**
 * Inline Consent Mode v2 defaults — must run before GTM / gtag.js (no network).
 * Opt-out model (owner decision 2026-10-26): `analytics_storage` is granted
 * unless the visitor stored a CMP choice that turns analytics off. Ad storage
 * stays denied until the visitor opts in.
 */
export const CONSENT_MODE_DEFAULTS_SCRIPT = `
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
var atbAnalytics='granted';
try{
  var atbStored=JSON.parse(localStorage.getItem('${CONSENT_STORAGE_KEY}')||'null');
  if(atbStored&&atbStored.analytics===false){atbAnalytics='denied';}
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
