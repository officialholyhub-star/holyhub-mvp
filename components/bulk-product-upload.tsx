"use client";

import { useActionState, useState } from "react";
import { processProductCsv, type BulkState } from "@/app/lister/products/bulk/actions";
import { MAX_CSV_BYTES } from "@/lib/product-csv";
import styles from "./bulk-product-upload.module.css";

export function BulkProductUpload() {
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState("");
  const [state, action, pending] = useActionState<BulkState, FormData>(processProductCsv, {});
  const [reviewedCsv, setReviewedCsv] = useState("");
  const [reading, setReading] = useState(false);
  const current = csv === reviewedCsv;
  const valid = state.rows?.filter(row => row.product) ?? [];
  const invalid = state.rows?.filter(row => !row.product) ?? [];
  return <div className={styles.upload}>
    <form action={action} onSubmit={() => setReviewedCsv(csv)} className="form">
      <label className="field"><span>Upload your completed spreadsheet saved as CSV (maximum 256 KB)</span><input type="file" accept=".csv,text/csv" disabled={pending || reading} onChange={async event => {
        const file = event.currentTarget.files?.[0]; setCsv(""); setReviewedCsv(""); setFileError("");
        if (!file) return;
        if (file.size > MAX_CSV_BYTES) { setFileError("Choose a CSV smaller than 256 KB."); return; }
        setReading(true);
        try { setCsv(await file.text()); } catch { setFileError("We couldn't read that file."); } finally { setReading(false); }
      }} /></label>
      <input type="hidden" name="csv" value={csv} />
      <button className="button button-primary" disabled={!csv || pending || reading} type="submit">{pending ? "Checking…" : "Check spreadsheet"}</button>
    </form>
    {fileError && <p className="notice notice-error" role="alert">{fileError}</p>}
    {current && state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
    {current && state.rows && <div aria-live="polite">
      <h2>Review your products</h2>
      <p>{state.rows.length} products detected · {valid.length} ready to import · {invalid.length} need attention</p>
      <h3>Valid rows</h3>
      <ul className={styles.rows}>{valid.map(row => <li key={row.row}><strong>Row {row.row}: {row.product!.name}</strong><p>{row.product!.category_type} · £{row.product!.price.toFixed(2)} · {row.product!.sku || "No SKU"}</p><p>{row.product!.description}</p><p>{row.product!.sizes.length ? row.product!.sizes.map((size, i) => `${size}: ${row.product!.stockQuantities[i]}`).join(" · ") : `Stock: ${row.product!.stock_quantity}`}</p>{row.warnings.map(warning => <p key={warning}>{warning}</p>)}</li>)}</ul>
      {invalid.length > 0 && <><h3>Invalid rows — these will not be imported</h3><ul className={styles.rows}>{invalid.map(row => <li key={row.row}><strong>Row {row.row}</strong>{row.errors.map(error => <p key={error}>{error}</p>)}</li>)}</ul></>}
      {valid.length > 0 && <form action={action}><input type="hidden" name="csv" value={csv} /><input type="hidden" name="confirm" value="yes" /><button className="button button-primary" disabled={pending} type="submit">{pending ? "Importing…" : state.results ? "Retry / check this import" : `Confirm import of ${valid.length} drafts`}</button></form>}
    </div>}
    {current && state.results && <div role="status"><h2>Import results</h2><p>{state.results.filter(row => row.status === "imported").length} products imported successfully. {state.results.filter(row => row.status === "already imported").length} were already imported. {state.results.filter(row => row.status === "failed").length} were not imported or could not be confirmed.</p><ul className={styles.rows}>{state.results.map(row => <li key={row.row}>Row {row.row}{row.name ? `: ${row.name}` : ""} — {row.status}{row.message && <p>{row.message}</p>}</li>)}</ul><p>Retry the same file to complete failed rows. Completed rows will not be created again. Correct invalid rows in your spreadsheet before uploading a new file; keep existing SKUs to avoid importing products twice. For products without SKUs, retry the exact same file; a changed file is treated as a new import.</p></div>}
  </div>;
}
