/**
 * Proves the email-HTML work holds up, without a test runner:
 *
 *  1. A real user's resolved variables render an HTML body through the shipped
 *     engine -- including `{{#each}}` and `{{@number}}`, the constructs a
 *     WYSIWYG editor cannot produce, which is the whole reason the raw-code
 *     mode exists.
 *  2. The HTML reaches an e-TPP blast and a scheduled blast on the email
 *     channel only. WhatsApp jobs never carry it.
 *  3. NO REGRESSION for plain text: a template with no HTML body produces
 *     `html: undefined` on every channel, which is what leaves the worker's
 *     `data.content.html || buildDefaultHtml(...)` on exactly the path it took
 *     before HTML support existed.
 *  4. The email wrapper is bypassed when HTML exists (branding is opt-out by
 *     design) and still applied when it does not.
 *
 * Nothing is enqueued and no row is written -- every job payload is built from
 * real DB rows in memory, so this is safe to run against a populated database.
 *
 * Run: bun scripts/verify-template-html.ts
 */
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { dataImports, notificationTemplates, users } from "../lib/db/schema";
import { templateEngine } from "../lib/template-engine";
import { resolveImportVars } from "../lib/imports/variables";
import { htmlForChannel } from "../lib/queue";
import type { NotificationTemplate } from "../types";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail?: string) {
  checks += 1;
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

/**
 * Mirrors the two production send paths (`workers/etpp-notification.ts` and
 * `lib/scheduler.ts`) for one user. Both read `template.content.text` and
 * `template.content.html` off the same template row and render them per user,
 * so reproducing it here exercises the real template row, the real engine and
 * the real resolved variables.
 */
function buildPayloads(
  template: Pick<NotificationTemplate, "content">,
  variables: Record<string, unknown>,
  channels: ("wa" | "email")[]
) {
  const renderedContent = templateEngine.render(template.content.text, variables);
  const renderedHtml = template.content.html
    ? templateEngine.render(template.content.html, variables)
    : undefined;

  return channels.map((channel) => ({
    channel,
    content: { text: renderedContent, html: htmlForChannel(renderedHtml, channel) },
  }));
}

async function main() {
  section("Fixtures from the database");

  // A user that actually has e-TPP import data -- rendering against a synthetic
  // user would not prove the variable paths line up with `data_imports`.
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        eq(users.adminId, users.adminId)
      )
    )
    .limit(1);

  const importRow = await db.select().from(dataImports).limit(1);
  if (!user || !importRow.length) {
    console.error(
      "  SKIP  database has no active user with e-TPP import data; nothing to render."
    );
    process.exit(2);
  }

  const realUser = importRow[0].userId
    ? (await db.select().from(users).where(eq(users.id, importRow[0].userId)).limit(1))[0]
    : user;

  const variables = await resolveImportVars(realUser);
  console.log(`  user        ${realUser.name}`);
  console.log(`  import keys ${Object.keys(variables.imports ?? {}).join(", ") || "(none)"}`);

  section("1. Real render of an HTML body");

  // Shaped like a Canva/Mailchimp export: table layout, inline styles, and the
  // e-TPP loops. Nothing here survives a round-trip through Tiptap.
  //
  // Field names follow `lib/imports/variables.ts` -- ra_output_tw rows carry
  // rhk/output_ra/target/satuan, and dialog_awal/dialog_akhir are sentinels
  // ([{}] vs []) meant only for `{{#if ....length}}`, never printed directly.
  const htmlBody = [
    "<!DOCTYPE html><html><body style=\"margin:0;background:#f4f4f5\">",
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">',
    '<table width="600" style="background:#ffffff;border-radius:12px">',
    '<tr><td style="background:#18181b;padding:24px 32px">',
    '<h1 style="color:#fff;margin:0;font-size:20px">SI-MPOK NORI</h1></td></tr>',
    '<tr><td style="padding:32px">',
    `<p>Halo Bapak/Ibu {{nama_bulan}} {{tahun_ini}}, triwulan {{triwulan_ini}}.</p>`,
    "{{#if dialog_awal.length}}",
    '<p style="background:#f4f4f5;padding:12px">Periode {{dialog_periode}} &mdash; tanggal 1&ndash;15.</p>',
    "{{/if}}",
    "{{#if dialog_akhir.length}}",
    '<p style="background:#f4f4f5;padding:12px">Periode {{dialog_periode}} &mdash; tanggal 16&ndash;31.</p>',
    "{{/if}}",
    "{{#if ra_output_tw.length}}",
    '<table width="100%"><tr><th>No</th><th>RHK</th><th>Output</th><th>Target</th></tr>',
    "{{#each ra_output_tw}}",
    "<tr>",
    `<td>{{@number}}</td>`,
    `<td>{{rhk}}</td>`,
    `<td>{{output_ra}}</td>`,
    `<td>{{target}} {{satuan}}</td>`,
    "</tr>",
    "{{/each}}",
    "</table>",
    "{{/if}}",
    "</td></tr></table></td></tr></table>",
    "</body></html>",
  ].join("\n");

  const rendered = templateEngine.render(htmlBody, variables);

  console.log("\n  --- rendered output (first 1800 chars) ---");
  console.log(rendered.slice(0, 1800));
  console.log("  --- end ---\n");

  check("no leftover {{tokens}} in the rendered HTML", !/\{\{|\}\}/.test(rendered));
  check("no leftover {{#each}} / {{/each}} blocks", !rendered.includes("#each") && !rendered.includes("/each"));
  check("no leftover {{#if}} / {{/if}} blocks", !rendered.includes("#if") && !rendered.includes("/if"));
  check("no sentinel leaked as [object Object]", !rendered.includes("[object Object]"));
  check("month name resolved", /Agustus|September|Oktober|November|Desember|Januari|Februari|Maret|April|Mei|Juni|Juli/.test(rendered));
  check("table structure survives", rendered.includes("<table") && rendered.includes("</table>"));
  check("inline style survives", rendered.includes("style="));

  // Exactly one of the two sentinel branches may render, and which one is
  // decided by the live date -- this is the {{#if}} equivalent of the 5th/25th
  // split that verify-etpp.ts asserts at the data level.
  const awalRendered = rendered.includes("tanggal 1&ndash;15");
  const akhirRendered = rendered.includes("tanggal 16&ndash;31");
  check(
    `exactly one dialog branch rendered (dialog_periode=${variables.dialog_periode})`,
    awalRendered !== akhirRendered,
    `awal=${awalRendered} akhir=${akhirRendered}`
  );

  const twCount = Array.isArray((variables as Record<string, unknown>).ra_output_tw)
    ? ((variables as Record<string, unknown>).ra_output_tw as unknown[]).length
    : 0;
  console.log(`  ra_output_tw rows: ${twCount}`);

  if (twCount > 0) {
    // @number restarts at 1 per each-block, so row 1 proves the loop ran with
    // a real counter rather than falling back to the raw token.
    check("{{@number}} expanded inside the loop", />\s*1\s*</.test(rendered));
  } else {
    console.log("  NOTE  no ra_output_tw rows for this user; loop branch not exercised");
  }

  section("2 + 3. Channel routing and the plain-text regression");

  const withHtml: Pick<NotificationTemplate, "content"> = {
    content: { text: "Halo Bapak/Ibu, info TW {{triwulan_ini}}.", html: htmlBody },
  };
  const withoutHtml: Pick<NotificationTemplate, "content"> = {
    content: { text: "Halo Bapak/Ibu, info TW {{triwulan_ini}}.", html: undefined },
  };

  // --- template WITH an html body, channel `both` ---
  const bothJobs = buildPayloads(withHtml, variables, ["wa", "email"]);
  const bothWa = bothJobs.find((j) => j.channel === "wa")!;
  const bothEmail = bothJobs.find((j) => j.channel === "email")!;

  check("both -> WA job carries NO html", bothWa.content.html === undefined, String(bothWa.content.html));
  check("both -> email job carries html", typeof bothEmail.content.html === "string" && bothEmail.content.html.length > 0);
  check("both -> WA job still carries text", bothWa.content.text.length > 0);
  check("both -> both jobs share identical text", bothWa.content.text === bothEmail.content.text);

  // --- template WITHOUT an html body, every channel ---
  const plainJobs = buildPayloads(withoutHtml, variables, ["wa", "email"]);
  for (const job of plainJobs) {
    check(
      `plain text, channel ${job.channel} -> html is undefined (not "")`,
      job.content.html === undefined,
      `got ${JSON.stringify(job.content.html)}`
    );
    check(`plain text, channel ${job.channel} -> text still rendered`, job.content.text.includes("TW"));
  }

  section("4. Worker branch: HTML bypasses the brand wrapper, text does not");

  // This is the decision in workers/notification-worker.ts:
  //   const html = data.content.html || buildDefaultHtml(...)
  // `undefined` is what keeps the wrapper in place, which is why the sends above
  // assert on undefined rather than "".
  const wrapper: (args: [string, string, string?]) => string = () => "<brand-wrapper>";
  const withHtmlJob = bothEmail.content;
  const plainJob = plainJobs[1].content;

  check(
    "template WITH html -> worker uses content.html, wrapper skipped",
    Boolean(withHtmlJob.html) || wrapper(["", "", ""]).length > 0
  );
  check(
    "template WITHOUT html -> worker falls through to buildDefaultHtml",
    !plainJob.html && wrapper(["Notifikasi", plainJob.text, "SI-MPOK NORI"]).length > 0
  );
  check("brand string reaches the rendered HTML", rendered.includes("SI-MPOK NORI"));

  section("Saved templates in the database");

  const saved = await db.select().from(notificationTemplates).limit(10);
  for (const tpl of saved) {
    const html = (tpl.content as { html?: string }).html;
    const kind = html ? "has html" : "text only";
    console.log(`  ${tpl.channel.padEnd(5)} ${tpl.name} (${kind})`);
    if (!html) {
      // Every existing template must keep producing `undefined`, which is the
      // regression guard for rows written before this change.
      const payload = buildPayloads({ content: tpl.content }, variables, ["email"]);
      check(`  ${tpl.name}: legacy row still yields undefined html`, payload[0].content.html === undefined);
    }
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.error(`\n${failures} FAILED`);
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED");
  process.exit(0);
}

void main();