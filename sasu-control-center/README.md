# sasu-control-center

Application Next.js (DigitPro Consulting Monitoring) — dashboard, import CSV, synchronisation Qonto / Powens (Revolut personnel), Supabase.

**Périmètre :** pas d’intégration API « portail factures » ni de sync factures tierce ; le revenu et les graphiques (dont jours facturés) s’appuient sur les **transactions** importées. Une migration Supabase supprime l’ancienne table `invoices` si elle existait encore.
