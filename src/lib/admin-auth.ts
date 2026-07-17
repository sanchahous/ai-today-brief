import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase/server';

export interface SocialAdminSession {
  userId: string;
  email: string;
  role: 'owner' | 'editor' | 'analyst';
  aal: 'aal1' | 'aal2';
}

function allowlisted(email: string) {
  return (process.env.SOCIAL_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLocaleLowerCase())
    .filter(Boolean)
    .includes(email.toLocaleLowerCase());
}

export const getSocialAdminSession = cache(async (): Promise<SocialAdminSession | null> => {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user?.email) return null;

  const admin = getSupabaseAdmin();
  let { data: membership } = await admin
    .from('social_admins')
    .select('role,enabled')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership && allowlisted(user.email)) {
    const { data: created } = await admin
      .from('social_admins')
      .upsert({ user_id: user.id, role: 'owner', enabled: true })
      .select('role,enabled')
      .single();
    membership = created;
  }
  if (!membership?.enabled) return null;

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    userId: user.id,
    email: user.email,
    role: membership.role as SocialAdminSession['role'],
    aal: assurance?.currentLevel === 'aal2' ? 'aal2' : 'aal1',
  };
});

export async function requireSocialAdmin(options: { aal2?: boolean } = {}) {
  const session = await getSocialAdminSession();
  if (!session) redirect('/admin/login');
  if (options.aal2 && session.aal !== 'aal2') redirect('/admin/mfa');
  return session;
}
