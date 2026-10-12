# Activate Google Sheets writes

The website's read-only shared data already works. Direct saves require this script to be deployed by the Google Sheet owner. This workspace has no usable Google write credentials.

1. Open the existing Durgamatha Sheet. Choose **Extensions → Apps Script**.
2. In a new Apps Script project, replace the default `Code.gs` with the complete contents of this directory's `Code.gs` and save. If the Sheet already has script code, preserve it; do not overwrite existing functions or install duplicate `doGet` / `doPost` handlers. It already targets your Sheet and website origin.
3. Select `setupBudgetDatabase` and click **Run**. Review Google's requested spreadsheet permissions and authorize your own project. Existing expense/member data remains intact; empty `Transactions` and `Budgets` tabs are added if missing.
4. Copy the generated editor key from the Sheet's alert into a password manager. Do not paste it into chat or repository files. If the alert was missed, run `rotateEditorKey` to generate a replacement; this invalidates the previous key.
5. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me**, **Who has access: Anyone**, then deploy. The endpoint provides public reads, matching the existing public dashboard, while every mutation requires the editor key.
6. Copy the deployment URL ending in `/exec` and send only that URL to the developer. The `/dev` URL will not work for public visitors. Workspace domain policies can restrict the **Anyone** option; if so, this deployment approach requires a different authenticated backend.
7. The developer sets `apiUrl` in `public/shared-source.json` and publishes the app. After that, open the app, choose **Unlock editing**, and enter the editor key. The key stays only in memory in the current tab. Other viewers do not need it.

Writes become visible in the author's view after Google confirms them. Active viewers poll the live endpoint about every 30 seconds, and **Refresh data** reads immediately. Background tabs and open edit forms do not poll. Snapshot synchronization remains as the read-only fallback when no API is configured.

## Supported records

- Expenses: add, edit and delete; total, paid, payer, source, reimbursement, sponsor, due date, remarks and category are preserved.
- Other income: add and delete in `Transactions`.
- Member contributions: add a member or update annual dues, cash and sponsorship. Existing names cannot be renamed because expense rows reference them.
- Opening fund and monthly budgets: update through the app.

The writer uses row IDs, an editor-key hash, serialized writes, revision checks, and request replay protection. It rejects invalid money, dates and formula-like input. It returns a current database snapshot after each confirmed operation. A timeout does not establish that a write failed; refresh before retrying. Conflicting writes are rejected rather than overwriting another editor's changes. The Sheet owner can edit records directly; the next refresh detects the changed revision.

When updating Apps Script code later, use **Deploy → Manage deployments → Edit → New version → Deploy** to update the same endpoint. Merely saving source does not update an existing deployment.
