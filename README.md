# sasu-control-center

Application Next.js (DigitPro Consulting Monitoring) — dashboard financier, imports CSV/Bankin, synchronisations Qonto/Powens, factures Hiway via Gmail en lecture seule, Supabase et client iOS.

La racine du dépôt est l'application active ; `sasu-control-center/` est une copie historique exclue du déploiement. Le revenu et les graphiques s'appuient sur les transactions importées ; les factures Hiway ont leur propre stockage.

Les protections et leur ordre d'activation sont documentés dans [la procédure de sécurité](docs/activation-securite-agents.md). Appliquer les migrations et le chiffrement des jetons avant de déployer les nouveaux lecteurs Gmail/Powens. L'accès agent est désactivé par défaut et limité aux agrégats professionnels.

Vérification : `npm test`, `npm run typecheck`, `npm run build`, `npm audit --omit=dev`. Lorsqu'un serveur de développement est actif, utiliser `NEXT_BUILD_DIR=.next-security-check npm run build` pour isoler le build.
