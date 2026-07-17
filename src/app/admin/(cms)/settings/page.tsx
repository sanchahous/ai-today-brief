import type { Json } from '@/lib/database.types';
import { StatusPill } from '@/components/admin/status-pill';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveCadenceSettings } from '@/lib/social/schedule';
import { signOutAction, updateAccountAction, updateSettingsAction } from '../../actions';

export const dynamic = 'force-dynamic';

const CHANNELS = ['telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook'] as const;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function enabled(value: Json, channel: string) {
  return Boolean(
    value && typeof value === 'object' && !Array.isArray(value) && value[channel] === true,
  );
}

export default async function SettingsPage() {
  await requireSocialAdmin();
  const supabase = getSupabaseAdmin();
  const [{ data: settings }, { data: accounts }] = await Promise.all([
    supabase.from('social_settings').select('*').eq('id', true).single(),
    supabase.from('social_accounts').select('*').order('channel'),
  ]);
  const accountByChannel = new Map((accounts ?? []).map((account) => [account.channel, account]));
  const cadence = resolveCadenceSettings(settings?.cadence);
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">Settings</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Safety and connections</h1>

      <form
        action={updateSettingsAction}
        className="mt-7 rounded-2xl border border-white/10 bg-[#151b20] p-5 sm:p-6"
      >
        <h2 className="text-lg font-bold text-white">Publishing controls</h2>
        <label className="mt-5 flex min-h-12 items-center justify-between gap-4 rounded-xl border border-red-400/25 bg-red-400/5 p-4">
          <span>
            <strong className="block text-red-100">Global kill switch</strong>
            <span className="text-xs text-red-200/60">
              Stops every claim before any provider call.
            </span>
          </span>
          <input
            type="checkbox"
            name="global_kill_switch"
            defaultChecked={settings?.global_kill_switch ?? true}
            className="size-6 accent-red-400"
          />
        </label>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {CHANNELS.map((channel) => (
            <label
              key={channel}
              className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 p-4"
            >
              <span className="font-bold text-slate-200 capitalize">{channel}</span>
              <input
                type="checkbox"
                name={`channel_${channel}`}
                defaultChecked={settings ? enabled(settings.channel_enabled, channel) : false}
                className="size-5 accent-[#47e4d3]"
              />
            </label>
          ))}
        </div>
        <div className="mt-6">
          <h3 className="font-bold text-white">Publishing cadence · Europe/Kyiv</h3>
          <p className="mt-1 text-xs text-slate-500">
            These slots drive new packages. Weekly Telegram stays Sunday at 18:00; Instagram and
            Facebook weekly posts use the time selected here.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {CHANNELS.map((channel) => (
              <fieldset key={channel} className="rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <legend className="font-bold text-slate-200 capitalize">{channel}</legend>
                  <input
                    type="time"
                    name={`cadence_${channel}_time`}
                    defaultValue={`${String(cadence[channel].hour).padStart(2, '0')}:${String(cadence[channel].minute).padStart(2, '0')}`}
                    required
                    className="min-h-10 rounded-lg border border-white/15 bg-[#0c1014] px-3 text-sm text-white"
                  />
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {DAYS.map((day, index) => (
                    <label
                      key={day}
                      className="grid min-h-11 place-items-center rounded-lg border border-white/10 px-1 text-[10px] font-bold text-slate-400 has-checked:border-[#47e4d3]/50 has-checked:bg-[#47e4d3]/10 has-checked:text-[#8af4e9]"
                    >
                      <input
                        type="checkbox"
                        name={`cadence_${channel}_day_${index}`}
                        defaultChecked={cadence[channel].days.includes(index)}
                        className="sr-only"
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
        <label className="mt-5 grid gap-2 text-sm font-semibold text-slate-300">
          X API hard cap · €/month
          <input
            type="number"
            name="x_monthly_budget_eur"
            min="0"
            max="10"
            step="0.5"
            defaultValue={settings?.x_monthly_budget_eur ?? 10}
            className="min-h-11 max-w-40 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-white"
          />
          <span className="text-xs font-normal text-slate-500">
            Reserved this month: €{settings?.x_monthly_spend_eur ?? 0}
          </span>
        </label>
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 p-4">
          <input
            type="checkbox"
            name="auto_publish_green"
            defaultChecked={settings?.auto_publish_green ?? false}
            disabled={(settings?.green_success_count ?? 0) < 30}
            className="mt-1 size-5 accent-[#47e4d3]"
          />
          <span>
            <strong className="block text-slate-200">Auto-publish green packages</strong>
            <span className="text-xs text-slate-500">
              Unlocks after 30 incident-free green deliveries. Current:{' '}
              {settings?.green_success_count ?? 0}/30.
            </span>
          </span>
        </label>
        <button className="mt-5 min-h-11 rounded-xl bg-[#47e4d3] px-5 text-sm font-bold text-[#0a2321]">
          Save controls · requires MFA
        </button>
      </form>

      <section className="mt-7">
        <h2 className="text-lg font-bold text-white">Accounts</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {CHANNELS.map((channel) => {
            const account = accountByChannel.get(channel);
            const oauthProvider =
              channel === 'linkedin'
                ? 'linkedin'
                : channel === 'threads'
                  ? 'threads'
                  : channel === 'instagram' || channel === 'facebook'
                    ? 'meta'
                    : null;
            return (
              <form
                key={channel}
                action={updateAccountAction}
                className="rounded-2xl border border-white/10 bg-[#151b20] p-5"
              >
                <input type="hidden" name="channel" value={channel} />
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-white capitalize">{channel}</h3>
                  <StatusPill value={account?.connection_health ?? 'unconfigured'} />
                </div>
                <label className="mt-4 grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  Handle
                  <input
                    name="handle"
                    defaultValue={account?.handle ?? ''}
                    className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-sm tracking-normal text-white normal-case"
                  />
                </label>
                <label className="mt-3 grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  Provider account ID
                  <input
                    name="provider_account_id"
                    defaultValue={account?.provider_account_id ?? ''}
                    className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-sm tracking-normal text-white normal-case"
                  />
                </label>
                <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={account?.enabled ?? false}
                    className="size-5 accent-[#47e4d3]"
                  />
                  Allow worker to claim this channel
                </label>
                <p className="mt-3 text-xs text-slate-500">
                  Token:{' '}
                  {account?.token_expires_at
                    ? `expires ${new Date(account.token_expires_at).toLocaleDateString()}`
                    : 'stored outside UI / not connected'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="min-h-10 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-200">
                    Save account
                  </button>
                  {oauthProvider ? (
                    <a
                      href={`/api/oauth/${oauthProvider}/start`}
                      className="min-h-10 rounded-xl border border-[#47e4d3]/30 px-4 py-2.5 text-sm font-bold text-[#8af4e9]"
                    >
                      Connect OAuth
                    </a>
                  ) : null}
                </div>
              </form>
            );
          })}
        </div>
      </section>

      <form action={signOutAction} className="mt-8">
        <button className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-300">
          Sign out
        </button>
      </form>
    </div>
  );
}
