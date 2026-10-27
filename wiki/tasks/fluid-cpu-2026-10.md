# Fluid CPU 2026-10

Summary: Виправлення вичерпаного ліміту Vercel Fluid Active CPU (Hobby, 4 год): гейт pg_cron-опитувань і публікація без site-wide `revalidateTag`.
Sources: [ops/vercel-fluid-cpu](../ops/vercel-fluid-cpu.md); `supabase/migrations/20261026120000_gate_idle_vercel_cron_polls.sql`; `src/lib/revalidate-site.ts`; `src/app/api/revalidate/route.ts`
Last updated: 2026-10-26

---

Task: fluid-cpu-2026-10

## Status

```verbatim
- **Fluid CPU 2026-10: гейт pg_cron + публікація без site-wide purge — PR відкрито, міграцію на production ще не застосовано (2026-10-26, гілка `fix/vercel-fluid-cpu`).** Діагноз і оцінки — [ops/vercel-fluid-cpu](../ops/vercel-fluid-cpu.md). (source: live check `vercel usage` / `vercel logs requests` / Supabase `cron.job` 2026-10-26)
```

IN REVIEW. Міграцію `20261026120000_gate_idle_vercel_cron_polls.sql` застосовує власник після review: вона переписує команди трьох наявних cron jobs. Без міграції код безпечний — він лише прибирає site-wide purge. Порядок «спершу код, потім міграція» теж безпечний. (source: [ops/vercel-fluid-cpu](../ops/vercel-fluid-cpu.md))

Наступний крок: після мержу і застосування міграції через 2–3 доби звірити `vercel usage --breakdown daily` (CPU, ISR writes) і частку `STALE` у `vercel logs requests`.

## Related pages

- [vercel-fluid-cpu](../ops/vercel-fluid-cpu.md)
- [social-cms-runbook](../ops/social-cms-runbook.md)
