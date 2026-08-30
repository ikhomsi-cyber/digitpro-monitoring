#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const commit = process.argv.includes("--commit");
const files = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

if (files.length !== 2) {
  throw new Error(
    "Usage: node scripts/import-bankin-personal-history.mjs [--commit] <ancien-export.xls> <export-recent.xls>"
  );
}

const EXPECTED_HEADERS = [
  "date",
  "description",
  "compte",
  "montant",
  "categorie",
  "sous-categorie",
  "note",
  "pointee"
];

function fold(raw) {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(raw) {
  return fold(raw);
}

function toIsoDate(raw) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const value = String(raw ?? "").trim();
  const french = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (french) {
    return `${french[3]}-${french[2].padStart(2, "0")}-${french[1].padStart(2, "0")}`;
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? value : null;
}

function toAmount(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const value = String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function formatHierarchy(parentRaw, subRaw) {
  const parentOriginal = String(parentRaw ?? "").trim();
  const parent = parentOriginal.replace(/\.\s*$/, "").trim();
  const sub = String(subRaw ?? "").trim();
  if (!parent && !sub) return "Non classé";
  if (!sub || sub === parentOriginal) return parent || sub;
  return `${parent} › ${sub}`;
}

function canonicalKey(row) {
  const label = row.label.trim().toLowerCase().replace(/\s+/g, " ");
  return `${row.date}|${label}|${Number(row.amount).toFixed(4)}`;
}

function daysBetween(a, b) {
  const left = new Date(`${a.slice(0, 10)}T12:00:00Z`);
  const right = new Date(`${b.slice(0, 10)}T12:00:00Z`);
  return Math.round(Math.abs(left.getTime() - right.getTime()) / 86_400_000);
}

function normalizeMerchant(raw) {
  return fold(raw)
    .replace(/^(\[[^\]]+\]\s*)+/i, "")
    .replace(/\b(cb|carte|card|cblm|paiement|payment)\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\biliass\s+khomsi\b/gi, " ")
    .replace(/\bkhomsi\s+iliass\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function merchantsMatch(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 3 && right.includes(left)) return true;
  if (right.length >= 3 && left.includes(right)) return true;
  const firstLeft = left.split(/\s+/)[0] ?? "";
  const firstRight = right.split(/\s+/)[0] ?? "";
  return firstLeft.length >= 3 && firstLeft === firstRight;
}

function fuzzyBankinMatch(existing, source) {
  if (Math.abs(Math.abs(Number(existing.amount)) - Math.abs(source.amount)) > 0.005) return false;
  if (daysBetween(String(existing.date), source.date) > 7) return false;
  return merchantsMatch(normalizeMerchant(existing.label), normalizeMerchant(source.label));
}

function hashPayload(payload) {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function readBankinFile(file) {
  const workbook = XLSX.readFile(file, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error(`Fichier vide : ${basename(file)}`);
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: ""
  });
  const headers = (matrix[0] ?? []).map(normalizeHeader);
  for (let index = 0; index < EXPECTED_HEADERS.length; index += 1) {
    if (headers[index] !== EXPECTED_HEADERS[index]) {
      throw new Error(`En-têtes Bankin inattendus dans ${basename(file)} (colonne ${index + 1}).`);
    }
  }

  const rows = [];
  for (let index = 1; index < matrix.length; index += 1) {
    const source = matrix[index] ?? [];
    const date = toIsoDate(source[0]);
    const amount = toAmount(source[3]);
    if (!date || amount == null) continue;
    const row = {
      date,
      label: String(source[1] ?? "").trim() || "Sans libellé",
      company: String(source[2] ?? "").trim() || "Compte perso",
      amount,
      category: formatHierarchy(source[4], source[5])
    };
    row.key = canonicalKey(row);
    rows.push(row);
  }
  return rows;
}

function learnCategoryTranslations(oldRows, recentRows) {
  const recentByKey = new Map();
  for (const row of recentRows) {
    if (!recentByKey.has(row.key)) recentByKey.set(row.key, row);
  }
  const votes = new Map();
  for (const row of oldRows) {
    const recent = recentByKey.get(row.key);
    if (!recent) continue;
    const targets = votes.get(row.category) ?? new Map();
    targets.set(recent.category, (targets.get(recent.category) ?? 0) + 1);
    votes.set(row.category, targets);
  }

  const translations = new Map();
  const ambiguous = [];
  for (const [source, targets] of votes) {
    const ranked = Array.from(targets.entries()).sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((sum, item) => sum + item[1], 0);
    const [target, matches] = ranked[0];
    const confidence = matches / total;
    if (confidence >= 0.9 || target === source) translations.set(source, target);
    else ambiguous.push({ source, target, confidence, total });
  }
  return { translations, ambiguous };
}

function combineExports(oldRows, recentRows) {
  const { translations, ambiguous } = learnCategoryTranslations(oldRows, recentRows);
  const combined = new Map();
  for (const row of oldRows) {
    if (combined.has(row.key)) continue;
    combined.set(row.key, {
      ...row,
      category: translations.get(row.category) ?? row.category
    });
  }
  // L’export récent (taxonomie française actuelle) est prioritaire sur le chevauchement.
  for (const row of recentRows) {
    if (!combined.has(row.key)) combined.set(row.key, row);
    else combined.set(row.key, row);
  }
  return { rows: Array.from(combined.values()), translations, ambiguous };
}

async function fetchAllTransactions(client, userId) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("transactions")
      .select(
        "id,user_id,date,label,category,category_manual,amount,company,bank_name,scope,content_hash,import_session_id,created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }
  return rows;
}

function existingKey(row) {
  return canonicalKey({
    date: String(row.date).slice(0, 10),
    label: String(row.label ?? ""),
    amount: Number(row.amount)
  });
}

function batch(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function isMissingColumn(error, column) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return message.includes(column.toLowerCase()) && /does not exist|could not find|schema cache/.test(message);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) throw new Error("Configuration Supabase administrateur manquante.");

  const oldRows = readBankinFile(files[0]);
  const recentRows = readBankinFile(files[1]);
  const combined = combineExports(oldRows, recentRows);
  const sourceByKey = new Map(combined.rows.map((row) => [row.key, row]));

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const usersResult = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (usersResult.error) throw new Error(usersResult.error.message);
  if (usersResult.data.users.length !== 1) {
    throw new Error(`Import interrompu : ${usersResult.data.users.length} utilisateurs trouvés, attendu 1.`);
  }
  const userId = usersResult.data.users[0].id;
  const allExisting = await fetchAllTransactions(client, userId);
  const personalExisting = allExisting.filter((row) => row.scope === "personal");
  const proCountBefore = allExisting.length - personalExisting.length;

  const existingPersonalByKey = new Map();
  for (const row of personalExisting) {
    const key = existingKey(row);
    const rows = existingPersonalByKey.get(key) ?? [];
    rows.push(row);
    existingPersonalByKey.set(key, rows);
  }

  const idsToDelete = new Set();
  const survivorByKey = new Map();
  for (const [key, rows] of existingPersonalByKey) {
    const canonicalHash = hashPayload(key);
    rows.sort((a, b) => {
      const aCanonical = a.content_hash === canonicalHash ? 0 : 1;
      const bCanonical = b.content_hash === canonicalHash ? 0 : 1;
      if (aCanonical !== bCanonical) return aCanonical - bCanonical;
      return String(a.created_at).localeCompare(String(b.created_at));
    });
    survivorByKey.set(key, rows[0]);
    for (const duplicate of rows.slice(1)) idsToDelete.add(duplicate.id);
  }

  const sourceByAbsoluteAmount = new Map();
  for (const source of combined.rows) {
    const amountKey = Math.abs(source.amount).toFixed(2);
    const rows = sourceByAbsoluteAmount.get(amountKey) ?? [];
    rows.push(source);
    sourceByAbsoluteAmount.set(amountKey, rows);
  }
  const fuzzyDuplicateIds = new Set();
  for (const [key, survivor] of survivorByKey) {
    if (sourceByKey.has(key) || !fold(survivor.company).includes("powens")) continue;
    const candidates = sourceByAbsoluteAmount.get(Math.abs(Number(survivor.amount)).toFixed(2)) ?? [];
    if (candidates.some((source) => fuzzyBankinMatch(survivor, source))) {
      fuzzyDuplicateIds.add(survivor.id);
      idsToDelete.add(survivor.id);
    }
  }

  const retainedHashOwner = new Map();
  for (const row of allExisting) {
    if (idsToDelete.has(row.id) || !row.content_hash) continue;
    retainedHashOwner.set(row.content_hash, row.id);
  }

  function desiredHash(key, survivorId = null) {
    const canonical = hashPayload(key);
    const owner = retainedHashOwner.get(canonical);
    if (!owner || owner === survivorId) return canonical;
    return hashPayload(`${key}|scope:personal`);
  }

  const updates = [];
  const inserts = [];
  let categoryUpdates = 0;
  for (const source of combined.rows) {
    const survivor = survivorByKey.get(source.key);
    if (survivor) {
      const contentHash = desiredHash(source.key, survivor.id);
      const changed =
        survivor.category !== source.category ||
        String(survivor.company ?? "") !== source.company ||
        survivor.scope !== "personal" ||
        survivor.content_hash !== contentHash ||
        survivor.category_manual === true;
      if (survivor.category !== source.category) categoryUpdates += 1;
      if (changed) {
        updates.push({
          id: survivor.id,
          date: source.date,
          label: source.label,
          amount: source.amount,
          company: source.company,
          category: source.category,
          category_manual: false,
          scope: "personal",
          content_hash: contentHash
        });
      }
    } else {
      inserts.push({
        user_id: userId,
        date: source.date,
        label: source.label,
        amount: source.amount,
        company: source.company,
        category: source.category,
        category_manual: false,
        scope: "personal",
        balance: null,
        bank_name: null,
        content_hash: desiredHash(source.key)
      });
    }
  }


  const shortCategoryHierarchy = new Map([
    ["NDF DigitPro", "Loisirs & Sorties › NDF DigitPro"],
    ["Repas dirigeant", "Divers › A catégoriser"]
  ]);
  let shortCategoryUpdates = 0;
  for (const [key, survivor] of survivorByKey) {
    if (sourceByKey.has(key) || idsToDelete.has(survivor.id)) continue;
    const category = shortCategoryHierarchy.get(String(survivor.category ?? ""));
    if (!category) continue;
    shortCategoryUpdates += 1;
    categoryUpdates += 1;
    updates.push({
      id: survivor.id,
      date: String(survivor.date).slice(0, 10),
      label: String(survivor.label ?? ""),
      amount: Number(survivor.amount),
      company: String(survivor.company ?? ""),
      category,
      category_manual: false,
      scope: "personal",
      content_hash: desiredHash(key, survivor.id)
    });
  }

  const audit = {
    mode: commit ? "commit" : "dry-run",
    source: {
      oldRows: oldRows.length,
      recentRows: recentRows.length,
      combinedUniqueTransactions: combined.rows.length,
      learnedCategoryTranslations: combined.translations.size,
      ambiguousTranslations: combined.ambiguous.length,
      dateMin: combined.rows.map((row) => row.date).sort()[0],
      dateMax: combined.rows.map((row) => row.date).sort().at(-1)
    },
    databaseBefore: {
      totalTransactions: allExisting.length,
      personalTransactions: personalExisting.length,
      proTransactions: proCountBefore,
      exactPersonalDuplicatesToRemove: idsToDelete.size - fuzzyDuplicateIds.size,
      fuzzyPowensDuplicatesToRemove: fuzzyDuplicateIds.size
    },
    planned: {
      inserts: inserts.length,
      updates: updates.length,
      categoryUpdates,
      shortCategoryUpdates,
      personalRowsOutsideExportsPreserved: Array.from(survivorByKey.keys()).filter(
        (key) => !sourceByKey.has(key) && !idsToDelete.has(survivorByKey.get(key).id)
      ).length
    }
  };
  console.log(JSON.stringify(audit, null, 2));
  if (!commit) return;

  const backupPath = `/private/tmp/sasu-control-center-bankin-personal-backup-${Date.now()}.json`;
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        sourceFiles: files.map((file) => basename(file)),
        personalTransactions: personalExisting
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  const fileDigests = await Promise.all(files.map(async (file) => hashPayload(await readFile(file))));
  const combinedFileHash = hashPayload(`bankin-personal-history-v2|${fileDigests.join("|")}`);
  let fileHashSupported = true;
  let existingSession = await client
    .from("import_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("file_hash", combinedFileHash)
    .maybeSingle();
  if (existingSession.error && isMissingColumn(existingSession.error, "file_hash")) {
    fileHashSupported = false;
    existingSession = { data: null, error: null };
  } else if (existingSession.error) {
    throw new Error(existingSession.error.message);
  }

  let importSessionId = existingSession.data?.id ?? null;
  if (!importSessionId) {
    const sessionBase = {
      user_id: userId,
      source_filename: files.map((file) => basename(file)).join(" + "),
      format: "bankin",
      row_count: combined.rows.length,
      inserted_count: 0,
      skipped_duplicate_count: oldRows.length + recentRows.length - combined.rows.length,
      merged_count: 0
    };
    let insertedSession = await client
      .from("import_sessions")
      .insert({
        ...sessionBase,
        ...(fileHashSupported ? { file_hash: combinedFileHash } : {})
      })
      .select("id")
      .single();
    if (insertedSession.error && isMissingColumn(insertedSession.error, "merged_count")) {
      const { merged_count: _mergedCount, ...legacySession } = sessionBase;
      insertedSession = await client
        .from("import_sessions")
        .insert({
          ...legacySession,
          ...(fileHashSupported ? { file_hash: combinedFileHash } : {})
        })
        .select("id")
        .single();
    }
    if (insertedSession.error) throw new Error(insertedSession.error.message);
    importSessionId = insertedSession.data.id;
  }

  for (const ids of batch(Array.from(idsToDelete), 200)) {
    const result = await client.from("transactions").delete().eq("user_id", userId).in("id", ids);
    if (result.error) throw new Error(result.error.message);
  }

  for (const rows of batch(updates, 25)) {
    const results = await Promise.all(
      rows.map(({ id, ...values }) =>
        client
          .from("transactions")
          .update({ ...values, import_session_id: importSessionId })
          .eq("user_id", userId)
          .eq("id", id)
      )
    );
    const error = results.find((result) => result.error)?.error;
    if (error) throw new Error(error.message);
  }

  for (const rows of batch(inserts, 200)) {
    const result = await client
      .from("transactions")
      .insert(rows.map((row) => ({ ...row, import_session_id: importSessionId })));
    if (result.error) throw new Error(result.error.message);
  }

  let sessionUpdate = await client
    .from("import_sessions")
    .update({
      inserted_count: inserts.length,
      skipped_duplicate_count: oldRows.length + recentRows.length - combined.rows.length,
      merged_count: updates.length
    })
    .eq("id", importSessionId);
  if (sessionUpdate.error && isMissingColumn(sessionUpdate.error, "merged_count")) {
    sessionUpdate = await client
      .from("import_sessions")
      .update({
        inserted_count: inserts.length,
        skipped_duplicate_count: oldRows.length + recentRows.length - combined.rows.length
      })
      .eq("id", importSessionId);
  }
  if (sessionUpdate.error) throw new Error(sessionUpdate.error.message);

  const after = await fetchAllTransactions(client, userId);
  const afterPersonal = after.filter((row) => row.scope === "personal");
  const afterByKey = new Map();
  for (const row of afterPersonal) {
    const key = existingKey(row);
    const rows = afterByKey.get(key) ?? [];
    rows.push(row);
    afterByKey.set(key, rows);
  }
  const duplicateRowsAfter = Array.from(afterByKey.values()).reduce(
    (sum, rows) => sum + Math.max(0, rows.length - 1),
    0
  );
  let missingSourceRows = 0;
  let categoryMismatches = 0;
  for (const source of combined.rows) {
    const stored = afterByKey.get(source.key)?.[0];
    if (!stored) missingSourceRows += 1;
    else if (stored.category !== source.category) categoryMismatches += 1;
  }
  const proCountAfter = after.filter((row) => row.scope !== "personal").length;
  const legacyShortCategoriesAfter = afterPersonal.filter((row) =>
    shortCategoryHierarchy.has(String(row.category ?? ""))
  ).length;

  const verification = {
    backupPath,
    inserted: inserts.length,
    updated: updates.length,
    duplicatesRemoved: idsToDelete.size,
    personalTransactionsAfter: afterPersonal.length,
    exactPersonalDuplicatesAfter: duplicateRowsAfter,
    legacyShortCategoriesAfter,
    missingSourceRows,
    categoryMismatches,
    proTransactionsUnchanged: proCountAfter === proCountBefore
  };
  console.log(JSON.stringify({ verification }, null, 2));
  if (
    duplicateRowsAfter !== 0 ||
    legacyShortCategoriesAfter !== 0 ||
    missingSourceRows !== 0 ||
    categoryMismatches !== 0 ||
    proCountAfter !== proCountBefore
  ) {
    throw new Error("La vérification post-import a détecté une incohérence. La sauvegarde est disponible.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
