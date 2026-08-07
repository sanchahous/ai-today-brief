import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { PROVIDER_ROLES } from '../../../../../pipeline/providers/registry';
import {
  deleteLlmProviderAction,
  storeLlmProviderSecretAction,
  updateLlmRoleChainAction,
  upsertLlmProviderAction,
} from './actions';

export const dynamic = 'force-dynamic';

const FIELD =
  'min-h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#47e4d3] focus:outline-none';
const TEXTAREA = `${FIELD} resize-y leading-6 font-mono text-xs`;
const LABEL = 'grid gap-2 text-sm font-semibold text-slate-200';
const PANEL = 'rounded-2xl border border-white/10 bg-[#151b20] p-5';
const PRIMARY =
  'min-h-11 rounded-xl bg-[#47e4d3] px-4 text-sm font-bold text-[#08211f] transition hover:bg-[#75eee2]';
const SECONDARY =
  'min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[.04]';
const DANGER =
  'min-h-11 rounded-xl border border-red-400/30 bg-red-400/8 px-4 text-sm font-bold text-red-200 transition hover:bg-red-400/15';

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const session = await requireSocialAdmin();
  const canEdit = session.role === 'owner' || session.role === 'editor';
  const canDelete = session.role === 'owner';

  const admin = getSupabaseAdmin();
  const query = await searchParams;
  const errorMessage = Array.isArray(query.error) ? query.error[0] : query.error;
  const [{ data: providers }, { data: models }, { data: roleChains }] = await Promise.all([
    admin.from('llm_providers').select('*').order('id'),
    admin.from('llm_provider_models').select('*').order('provider_id').order('rank'),
    admin.from('llm_role_chains').select('*'),
  ]);

  const modelsByProvider = new Map<string, string[]>();
  for (const model of models ?? []) {
    // Show every model, including disabled ones: this textarea is the full
    // round-trip source of truth for replace_llm_provider_models -- filtering
    // here would silently delete a disabled model's row on the next save.
    const list = modelsByProvider.get(model.provider_id) ?? [];
    list.push(model.model_id);
    modelsByProvider.set(model.provider_id, list);
  }
  const chainByRole = new Map((roleChains ?? []).map((row) => [row.role, row.chain]));

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold tracking-[.16em] text-[#47e4d3] uppercase">Providers</p>
      <h1 className="mt-2 text-3xl font-bold text-white">LLM provider registry</h1>
      {errorMessage ? (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3">
          <p className="text-sm font-bold text-red-100">{errorMessage}</p>
        </div>
      ) : null}
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Add or remove an OpenAI-compatible HTTP provider (e.g. a promotional free tier like NVIDIA
        NIM) without a deploy. CLI-subscription providers (Claude Code, Codex) still need their
        auth env var set in Vercel/GitHub secrets ahead of time -- a row here only controls
        ordering and enablement, not installing the binary or provisioning the token.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-200/90">
        This is live production config: the daily pipeline, weekly master writer/critic, social
        writer/critic and card-image scene briefs all resolve their provider chain through this
        registry, and a saved role chain below overrides the built-in default the moment you save
        it. See wiki/pipeline/llm-providers.md for exactly which call sites are migrated.
      </p>

      <section className="mt-7 grid gap-4">
        <h2 className="text-lg font-bold text-white">Providers</h2>
        {(providers ?? []).length === 0 ? (
          <p className={`${PANEL} text-sm text-slate-400`}>
            No providers configured yet -- add one below.
          </p>
        ) : null}
        {(providers ?? []).map((provider) => (
          <div key={provider.id} className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">{provider.id}</h3>
                <p className="text-xs text-slate-500">
                  {provider.kind} · {provider.enabled ? 'enabled' : 'disabled'}
                  {provider.kind === 'http' ? ` · ${provider.base_url}` : null}
                  {provider.kind === 'cli' ? ` · ${provider.binary_name} (${provider.auth_env_var})` : null}
                  {provider.secret_reference ? ' · key stored' : ' · no key stored'}
                </p>
              </div>
              {canDelete ? (
                <form action={deleteLlmProviderAction}>
                  <input type="hidden" name="id" value={provider.id} />
                  <ActionSubmitButton
                    idleLabel="Delete"
                    pendingLabel="Deleting…"
                    className={DANGER}
                  />
                </form>
              ) : null}
            </div>

            <form action={upsertLlmProviderAction} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={provider.id} />
              <input type="hidden" name="kind" value={provider.kind} />
              <div className="grid gap-3 md:grid-cols-2">
                {provider.kind === 'http' ? (
                  <label className={LABEL}>
                    Base URL
                    <input
                      name="base_url"
                      defaultValue={provider.base_url ?? ''}
                      disabled={!canEdit}
                      className={FIELD}
                    />
                  </label>
                ) : null}
                {provider.kind === 'cli' ? (
                  <>
                    <label className={LABEL}>
                      Binary name
                      <input
                        name="binary_name"
                        defaultValue={provider.binary_name ?? ''}
                        disabled={!canEdit}
                        className={FIELD}
                      />
                    </label>
                    <label className={LABEL}>
                      Auth env var
                      <input
                        name="auth_env_var"
                        defaultValue={provider.auth_env_var ?? ''}
                        disabled={!canEdit}
                        className={FIELD}
                      />
                    </label>
                  </>
                ) : null}
              </div>
              {provider.kind === 'http' ? (
                <label className={LABEL}>
                  Model IDs (one per line, tried in order)
                  <textarea
                    name="model_ids"
                    rows={4}
                    defaultValue={(modelsByProvider.get(provider.id) ?? []).join('\n')}
                    disabled={!canEdit}
                    className={TEXTAREA}
                  />
                </label>
              ) : null}
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={provider.enabled}
                    disabled={!canEdit}
                    className="size-5 accent-[#47e4d3]"
                  />
                  Enabled
                </label>
                {provider.kind === 'http' ? (
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      name="reports_cost"
                      defaultChecked={provider.reports_cost}
                      disabled={!canEdit}
                      className="size-5 accent-[#47e4d3]"
                    />
                    Reports real cost (usage.cost)
                  </label>
                ) : null}
              </div>
              <label className={LABEL}>
                Notes
                <input
                  name="notes"
                  defaultValue={provider.notes ?? ''}
                  disabled={!canEdit}
                  className={FIELD}
                />
              </label>
              <ActionSubmitButton
                idleLabel="Save provider"
                pendingLabel="Saving…"
                disabled={!canEdit}
                className={SECONDARY}
              />
            </form>

            {provider.kind === 'http' ? (
              <form action={storeLlmProviderSecretAction} className="mt-4 grid gap-2 border-t border-white/10 pt-4">
                <input type="hidden" name="provider_id" value={provider.id} />
                <label className={LABEL}>
                  API key {provider.secret_reference ? '(replace stored key)' : '(paste to store)'}
                  <input
                    type="password"
                    name="secret"
                    autoComplete="off"
                    disabled={!canEdit}
                    className={FIELD}
                  />
                </label>
                <p className="text-xs text-slate-500">
                  Stored in Supabase Vault, never shown again once saved -- requires MFA.
                </p>
                <ActionSubmitButton
                  idleLabel="Save key · requires MFA"
                  pendingLabel="Saving key…"
                  disabled={!canEdit}
                  className={SECONDARY}
                />
              </form>
            ) : null}
          </div>
        ))}
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-bold text-white">Add a provider</h2>
        <form action={upsertLlmProviderAction} className={`${PANEL} mt-3 grid gap-3`}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={LABEL}>
              Id (slug, e.g. &quot;nim&quot;)
              <input name="id" required disabled={!canEdit} className={FIELD} />
            </label>
            <label className={LABEL}>
              Kind
              <select name="kind" defaultValue="http" disabled={!canEdit} className={FIELD}>
                <option value="http">HTTP (OpenAI-compatible)</option>
                <option value="cli">CLI subscription</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
          </div>
          <label className={LABEL}>
            Base URL (HTTP only, e.g. https://integrate.api.nvidia.com/v1)
            <input name="base_url" disabled={!canEdit} className={FIELD} />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={LABEL}>
              Binary name (CLI only)
              <input name="binary_name" disabled={!canEdit} className={FIELD} />
            </label>
            <label className={LABEL}>
              Auth env var (CLI only)
              <input name="auth_env_var" disabled={!canEdit} className={FIELD} />
            </label>
          </div>
          <label className={LABEL}>
            Model IDs (HTTP only, one per line)
            <textarea name="model_ids" rows={3} disabled={!canEdit} className={TEXTAREA} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <input type="checkbox" name="enabled" defaultChecked disabled={!canEdit} className="size-5 accent-[#47e4d3]" />
            Enabled
          </label>
          <label className={LABEL}>
            Notes
            <input name="notes" disabled={!canEdit} className={FIELD} />
          </label>
          <ActionSubmitButton
            idleLabel="Add provider"
            pendingLabel="Adding…"
            disabled={!canEdit}
            className={PRIMARY}
          />
        </form>
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-bold text-white">Role chains</h2>
        <p className="mt-1 text-sm text-slate-500">
          Which providers each call site tries, in order, for roles that have been migrated onto
          the registry -- see wiki/pipeline/llm-providers.md for the current per-role status. An
          empty chain here is a no-op (falls back to the built-in default); a chain that resolves
          to zero usable providers (e.g. a key not pasted yet) also falls back to the default and
          logs a warning, it does not take the role down.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {PROVIDER_ROLES.map((role) => {
            const chain = chainByRole.get(role);
            const chainText = Array.isArray(chain)
              ? chain
                  .map((entry) =>
                    entry && typeof entry === 'object' && !Array.isArray(entry)
                      ? `${(entry as Record<string, unknown>).kind}:${(entry as Record<string, unknown>).id}`
                      : '',
                  )
                  .filter(Boolean)
                  .join('\n')
              : '';
            return (
              <form key={role} action={updateLlmRoleChainAction} className={`${PANEL} grid gap-2`}>
                <input type="hidden" name="role" value={role} />
                <label className={LABEL}>
                  {role}
                  <textarea
                    name="chain_text"
                    rows={3}
                    placeholder={'cli:claude-cli\nhttp:openrouter'}
                    defaultValue={chainText}
                    disabled={!canEdit}
                    className={TEXTAREA}
                  />
                </label>
                <ActionSubmitButton
                  idleLabel="Save chain"
                  pendingLabel="Saving…"
                  disabled={!canEdit}
                  className={SECONDARY}
                />
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
