/* Genesis keeps its canvas and bank rows in a separate snapshot format. */
if (typeof ZERKALIUS_PRESETS !== "undefined") {
  ZERKALIUS_PRESETS.base1 = ZZ_INITIAL_ROWS.join("\n");
}

function zzGenezisRowsMigrate(snapshot, raw){
  if (!snapshot || snapshot.rowsSequenceRevision === ZZ_ROWS_SEQUENCE_REVISION) return;
  const key = "zerkalius_autosave_v1";
  try {
    const backup = key + "_before_rows_sequence_" + ZZ_ROWS_SEQUENCE_REVISION;
    if (raw && !localStorage.getItem(backup)) localStorage.setItem(backup, raw);
  } catch (e) {}
  const lane = Math.max(0, Math.min(3, snapshot.activeBankIndex | 0));
  snapshot.activeBankIndex = lane;
  snapshot.rows = ZZ_INITIAL_ROWS.slice();
  if (!Array.isArray(snapshot.banks)) snapshot.banks = [];
  snapshot.banks = snapshot.banks.map(bank => typeof bank === "string" ? {lines: bank, patterns: ""} : bank);
  if (!snapshot.banks[lane] || typeof snapshot.banks[lane] !== "object") snapshot.banks[lane] = {patterns: ""};
  snapshot.banks[lane].lines = snapshot.rows.join("\n");
  snapshot.step = 0; snapshot.localSteps = snapshot.rows.map(() => 0);
  snapshot.active = [0]; snapshot.patterns = []; snapshot.patternsMetadata = {};
  snapshot.currentTargetPatternIdx = 0; snapshot.lastFindMethod = "Ожидание...";
  snapshot.rowsSequenceRevision = ZZ_ROWS_SEQUENCE_REVISION;
  try { localStorage.setItem(key, JSON.stringify(snapshot)); } catch (e) {}
}
