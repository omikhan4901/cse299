/**
 * Animated mockups for social posts, recorded from the real app with sample data
 * (docs/v2/BETA-PLAN.md, Phase 8). Frames come from Chrome's screencast at full resolution,
 * with a small pointer and a caption pill drawn on the page, then encoded with ffmpeg:
 *   square   1080×1080 MP4  (Facebook, Instagram feed)
 *   portrait 1080×1350 MP4  (Instagram 4:5)
 *   story    1080×1920 MP4  (Reels, Stories, TikTok; phone layout)
 *   wide     960×540 GIF    (GitHub README)
 *
 *   SITE=http://localhost:3400 API=http://localhost:5000/api DEMO_TOKEN=<jwt of the demo account> \
 *   FFMPEG=/path/to/ffmpeg PLAYWRIGHT_PATH=/path/to/playwright node record.mjs [scene…] [--formats=square,story]
 *
 * Scenes: build, ats, jobsearch. Output goes to ./out (git-ignored); copy the keepers to ../videos.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const SITE = process.env.SITE || "http://localhost:3400";
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const OUT = path.resolve(process.env.OUT || new URL("./out", import.meta.url).pathname);
const CHROMIUM = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PDF = new URL("../../../server/test/fixtures/single-column.pdf", import.meta.url).pathname;

const FORMATS = {
  square: { css: [1080, 1080], dpr: 1 },
  portrait: { css: [1080, 1350], dpr: 1 },
  story: { css: [432, 768], dpr: 2.5, mobile: true },
  wide: { css: [1280, 720], dpr: 1, gif: 960 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The pointer and caption pill, drawn on the page (screencasts don't show the real cursor). */
async function overlay(page) {
  await page.evaluate(() => {
    if (document.getElementById("__rx_cursor")) return;
    const c = document.createElement("div");
    c.id = "__rx_cursor";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#0f1f2a" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: 2147483647, pointerEvents: "none", transition: "transform 450ms cubic-bezier(.4,0,.2,1)", transform: "translate(60vw, 70vh)", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.25))" });
    document.body.appendChild(c);
    const cap = document.createElement("div");
    cap.id = "__rx_caption";
    Object.assign(cap.style, { position: "fixed", left: "50%", bottom: "5%", transform: "translate(-50%, 12px)", zIndex: 2147483646, pointerEvents: "none", background: "white", color: "#0f1f2a", border: "1px solid #e2e8f0", borderRadius: "999px", padding: "10px 20px", font: "600 17px Inter, system-ui, sans-serif", boxShadow: "0 10px 30px -12px rgba(15,31,42,.35)", opacity: "0", transition: "opacity 300ms, transform 300ms", whiteSpace: "nowrap", maxWidth: "92vw", overflow: "hidden", textOverflow: "ellipsis" });
    document.body.appendChild(cap);
  });
}
async function caption(page, text) {
  await overlay(page);
  await page.evaluate((t) => {
    const cap = document.getElementById("__rx_caption");
    if (!t) return Object.assign(cap.style, { opacity: "0", transform: "translate(-50%, 12px)" });
    cap.textContent = t;
    Object.assign(cap.style, { opacity: "1", transform: "translate(-50%, 0)" });
  }, text);
}
/** Glides the pointer to an element, then clicks it. */
async function clickOn(page, locator, { click = true } = {}) {
  await overlay(page);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("nothing to click");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(([x, y]) => (document.getElementById("__rx_cursor").style.transform = `translate(${x - 4}px, ${y - 3}px)`), [x, y]);
  await sleep(520);
  if (click) await page.mouse.click(x, y);
}
async function type(page, locator, text, delay = 55) {
  await clickOn(page, locator);
  await locator.pressSequentially(text, { delay });
}

async function record(browser, scene, formatName) {
  const f = FORMATS[formatName];
  const ctx = await browser.newContext({ viewport: { width: f.css[0], height: f.css[1] }, deviceScaleFactor: f.dpr, isMobile: !!f.mobile, hasTouch: !!f.mobile });
  const page = await ctx.newPage();
  await page.addInitScript((token) => {
    // A calm, known state: no tour, no welcome, signed in only when the scene asks.
    localStorage.setItem("resumex.tour.done", "1");
    if (token) localStorage.setItem("token", token);
  }, scene.signedIn ? process.env.DEMO_TOKEN : null);
  if (scene.setup) await scene.setup(page, f);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: Math.round(f.css[0] * f.dpr), maxHeight: Math.round(f.css[1] * f.dpr) });
  await scene.run(page, f);
  await sleep(1200);
  await cdp.send("Page.stopScreencast");
  await ctx.close();

  // Frames arrive only when something changes: each is shown until the next one.
  const dir = path.join(OUT, `${scene.name}-${formatName}-frames`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const lines = [];
  frames.forEach((fr, i) => {
    const file = path.join(dir, `${String(i).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(fr.data, "base64"));
    const next = frames[i + 1]?.t ?? fr.t + 1.5;
    lines.push(`file '${file}'`, `duration ${Math.max(0.01, next - fr.t).toFixed(3)}`);
  });
  lines.push(`file '${path.join(dir, `${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
  fs.writeFileSync(path.join(dir, "list.txt"), lines.join("\n"));
  const [w, h] = [Math.round(f.css[0] * f.dpr), Math.round(f.css[1] * f.dpr)];
  const mp4 = path.join(OUT, `${scene.name}-${formatName}.mp4`);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", `fps=30,scale=${w - (w % 2)}:${h - (h % 2)}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", mp4]);
  let out = mp4;
  if (f.gif) {
    out = path.join(OUT, `${scene.name}-${formatName}.gif`);
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", mp4, "-vf", `fps=12,scale=${f.gif}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, out]);
    fs.rmSync(mp4);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`  ${path.basename(out)}  ${frames.length} frames, ${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB`);
}

const SCENES = {
  build: {
    name: "build",
    async run(page, f) {
      await page.goto(`${SITE}/builder?new=1`);
      await page.getByPlaceholder("Jane Doe").waitFor({ timeout: 60000 });
      await sleep(1000);
      await caption(page, "Type, and the real PDF updates as you go");
      const keep = page.getByRole("button", { name: "Keep example" });
      if (await keep.count()) await clickOn(page, keep);
      for (const [ph, text] of [["Jane Doe", "Nusrat Jahan"], ["Full Stack Developer", "Software Engineer"]]) {
        const field = page.getByPlaceholder(ph);
        await clickOn(page, field);
        await field.selectText();
        await field.pressSequentially(text, { delay: 60 });
        await sleep(500);
      }
      await sleep(1400);
      if (!f.mobile) {
        await caption(page, "Switch designs in one click");
        await clickOn(page, page.locator(".ant-segmented-item", { hasText: "Design" }).first());
        await sleep(1200);
        const designs = page.getByRole("button", { name: /^Use the .* template$/ });
        for (const n of [1, 2, 3]) {
          if ((await designs.count()) > n) {
            await clickOn(page, designs.nth(n));
            await sleep(1800);
          }
        }
        await caption(page, "Your colours and fonts");
        const colours = page.locator('[aria-label^="Accent "]');
        if ((await colours.count()) > 3) {
          await clickOn(page, colours.nth(2));
          await sleep(1600);
        }
      }
      if (f.mobile) {
        await caption(page, "The real PDF, on your phone too");
        const preview = page.locator(".ant-segmented-item", { hasText: "Preview" }).first();
        if (await preview.count()) {
          await clickOn(page, preview);
          await page.locator('canvas[aria-label="Resume page 1"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
          await sleep(3000);
        }
      }
      await caption(page, "Free to build, check and download");
      await sleep(2000);
    },
  },
  ats: {
    name: "ats",
    async run(page) {
      await page.goto(`${SITE}/ats-checker`);
      await sleep(1500);
      await caption(page, "Will an ATS read your CV? Drop in the PDF");
      await page.locator("input[type=file]").first().setInputFiles(PDF);
      await sleep(1200);
      await caption(page, "Add the job to see the keywords you're missing");
      await clickOn(page, page.getByText("Add a job description").first());
      await sleep(500);
      const jd = page.getByPlaceholder(/Paste the job description/);
      await jd.fill("Junior Software Engineer. Requirements: JavaScript, React, Node.js, SQL, REST APIs, Git, unit testing, Docker. 0-2 years of experience. BSc in CSE.");
      await sleep(900);
      await clickOn(page, page.getByRole("button", { name: /Check against this job|Check my resume/ }));
      await caption(page, "30+ checks, like the software employers use");
      await sleep(7000);
      await page.mouse.wheel(0, 450);
      await sleep(2600);
      await page.mouse.wheel(0, 450);
      await sleep(2400);
      await caption(page, "Free, and your file is never stored");
      await sleep(2200);
    },
  },
  jobsearch: {
    name: "jobsearch",
    signedIn: true,
    async run(page) {
      await page.goto(`${SITE}/applications`);
      await sleep(3500);
      await caption(page, "Every job you apply to, on one board");
      await sleep(2200);
      await caption(page, "Paste a job circular");
      await clickOn(page, page.getByRole("button", { name: /Add application/ }).first());
      await sleep(700);
      const paste = page.getByPlaceholder(/https:\/\/… or the full job post/);
      await clickOn(page, paste);
      await paste.fill("Junior Software Engineer at Pathao, Dhaka. We are looking for a graduate with JavaScript, React and SQL. Apply by 25 October 2026.");
      await sleep(900);
      await clickOn(page, page.getByRole("button", { name: "Analyze" }));
      await sleep(1600);
      await caption(page, "Title, company and deadline, found for you");
      await sleep(2000);
      await clickOn(page, page.getByRole("button", { name: "Save application" }));
      await sleep(2200);
      await caption(page, "Reminders before every deadline");
      await sleep(2500);
    },
  },
};

const args = process.argv.slice(2);
const formats = (args.find((a) => a.startsWith("--formats="))?.split("=")[1] || "square,portrait,story,wide").split(",");
const scenes = args.filter((a) => !a.startsWith("--"));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined });
for (const name of scenes.length ? scenes : Object.keys(SCENES)) {
  console.log(name);
  for (const fmt of formats) await record(browser, SCENES[name], fmt).catch((err) => console.log(`  ${name}-${fmt} failed: ${err.message.split("\n")[0]}`));
}
await browser.close();
