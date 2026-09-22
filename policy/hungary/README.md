# Hungary — AI policy primary sources

Collected 2026-09-22. Every file here was fetched from an official government,
gazette, or parliamentary host. Nothing in this folder is edited by hand — it is
an archive of primary sources, reproduced as published.

Rebuild or refresh with:

```bash
npm run fetch:hungary
```

`sources.json` is the manifest (URLs, issuers, dates, mirrors). `fetch-log.json`
records what was retrieved, when, and the sha256 of each file, so a later run
shows whether an official document changed underneath us.

## A. National strategies

| Ref | Document | File |
|-----|----------|------|
| A1 | **Magyarország Mesterséges Intelligencia Stratégiája (2025–2030)** — NGM, published 2025-09-04. 119 pp. Six pillars (regulation, infrastructure, education, data economy, R&D, adoption), three priority domains. Target: 15% AI-driven GDP growth by 2030. | [`pdf/strategy-2025-2030-hu.pdf`](pdf/strategy-2025-2030-hu.pdf) |
| A1b | 1324/2025. (IX. 3.) Korm. határozat — adopting decision | [`html/korm-hatarozat-1324-2025.html`](html/korm-hatarozat-1324-2025.html) |
| A2 | **Magyarország Mesterséges Intelligencia Stratégiája (2020–2030)** — ITM, May 2020, published 2020-10-20 | [`pdf/strategy-2020-2030-hu.pdf`](pdf/strategy-2020-2030-hu.pdf) |
| A2b | 1573/2020. (IX. 9.) Korm. határozat — adopting decision | [`html/korm-hatarozat-1573-2020.html`](html/korm-hatarozat-1573-2020.html) |
| A2-en | English edition of the 2020 strategy | **not retrieved** — see [Gaps](#gaps) |

## B. Primary legislation and regulations (EU AI Act implementation)

| Ref | Document | File |
|-----|----------|------|
| B3 | **2025. évi LXXV. törvény** — implements Regulation (EU) 2024/1689. In force 2025-12-01. Establishes one notifying authority, one market surveillance authority, the Hungarian AI Council, and a regulatory sandbox running to August 2026. | [`pdf/act-lxxv-2025-magyar-kozlony.pdf`](pdf/act-lxxv-2025-magyar-kozlony.pdf) |
| B3b | Consolidated text (NJT) | [`html/act-lxxv-2025-consolidated.html`](html/act-lxxv-2025-consolidated.html) |
| B3c | Explanatory memorandum (indokolás) | [`html/act-lxxv-2025-indokolas.html`](html/act-lxxv-2025-indokolas.html) |
| B4 | Bill T/12632 as submitted to Parliament, 2025-09-23 | **not retrieved** — see [Gaps](#gaps) |
| B5 | **344/2025. (X. 31.) Korm. rendelet** — designates the authorities, converts the AI Act fine ceilings into forint, sets conformity assessment. In force 2025-12-01. | [`html/korm-rendelet-344-2025.html`](html/korm-rendelet-344-2025.html) |

## C. Government decisions (Korm. határozat)

| Ref | Document | File |
|-----|----------|------|
| C6 | **1301/2024. (IX. 30.)** — first decision on the implementation model: single organisation under the Minister for the Economy, sandbox, AI Council. Set a 2024-11-30 deadline for the bill, which was missed. | [`html/korm-hatarozat-1301-2024.html`](html/korm-hatarozat-1301-2024.html) |
| C7 | **1149/2025. (V. 14.)** — assigns market surveillance and the AI contact point to the Minister for the Economy; the National Accreditation Authority becomes the notifying authority. | [`pdf/korm-hatarozat-1149-2025-magyar-kozlony.pdf`](pdf/korm-hatarozat-1149-2025-magyar-kozlony.pdf) · [`html`](html/korm-hatarozat-1149-2025.html) |
| C8 | **1404/2025. (XI. 4.)** — international AI cooperation: AI in foreign policy, partnerships with the US, China, Israel, the UAE, Germany and Austria; data-centre investment conditions. | [`html/korm-hatarozat-1404-2025.html`](html/korm-hatarozat-1404-2025.html) |
| C9 | **1405/2025. (XI. 4.)** — public awareness: AI education at every level, mandatory civil service training ("MI Jövünk"), a Hungarian ELLIS centre, grants. Deadlines 2026-05-31 and 2026-12-31. | [`html/korm-hatarozat-1405-2025.html`](html/korm-hatarozat-1405-2025.html) |
| C10 | **1406/2025. (XI. 4.)** — strategic strengthening: an AI officer in every ministry by 2026-03-31, industry sandboxes, public-sector and health AI strategies, an Urban-tech platform, a national industrial capability survey. | [`pdf/korm-hatarozat-1406-2025-magyar-kozlony.pdf`](pdf/korm-hatarozat-1406-2025-magyar-kozlony.pdf) · [`html`](html/korm-hatarozat-1406-2025.html) |

## D. 2026 developments (new government)

After the April 2026 election a new government (Tisza) created the
**Tudományos és Technológiai Minisztérium** (Ministry of Science and
Technology), minister **Tanács Zoltán**.

| Ref | Document | File |
|-----|----------|------|
| D11 | **90/2026. (V. 13.) Korm. rendelet** — powers of the new government's members | [`html/korm-rendelet-90-2026.html`](html/korm-rendelet-90-2026.html) |
| D12 | **139/2026. (VIII. 31.) Korm. rendelet** — moves AI market surveillance from the Minister for the Economy and Energy to the Minister for Science and Technology | [`html/korm-rendelet-139-2026.html`](html/korm-rendelet-139-2026.html) |
| D13 | Mesterséges Intelligencia Hivatal / MI Piacfelügyeleti Hatóság — authority site | [`html/mihivatal-rolunk.html`](html/mihivatal-rolunk.html) |

A new science and innovation strategy was presented to Parliament's education
committee in August–September 2026 — a new AI research institute, a separate AI
agency, 100 AI researchers. **No official document has been published yet.**

## Notes on the files

**The Magyar Közlöny PDFs are whole gazette issues, not extracts.** B3 is issue
2025/127 (218 pp.); Act LXXV begins at p. 8201. C10 is issue 2025/128 (64 pp.)
and contains decisions 1404, 1405 *and* 1406 — one file covers C8, C9 and C10.
C7 is issue 2025/56 (52 pp.).

**The NJT pages are saved as HTML** because njt.jog.gov.hu publishes no PDF
export. They are the consolidated, currently-in-force texts — which means they
reflect the law as amended, not as originally enacted. For the text as
published, use the gazette PDF.

`njt.hu` resets automated connections; the manifest uses the `njt.jog.gov.hu`
mirror, which serves the same text.

## Gaps

Two documents could not be retrieved automatically. Both sit behind Cloudflare
bot challenges, which this repository's fetcher does not attempt to defeat.
Download them in a browser and drop them in at the paths below — `npm run
fetch:hungary` will then leave them alone.

| Ref | Document | Save as | Why |
|-----|----------|---------|-----|
| B4 | Bill T/12632 | `pdf/bill-t12632.pdf` | [parlament.hu](https://www.parlament.hu/irom42/12632/12632.pdf) returns a CAPTCHA interstitial |
| A2-en | 2020 strategy, English edition | `pdf/strategy-2020-2030-en.pdf` | [ai-hungary.com](https://ai-hungary.com/files/api/v1/companies/15/files/146074/view.pdf) and [mik.neum.hu](https://mik.neum.hu/wp-content/uploads/2025/03/2020-hungarian-AI-strategy.pdf) both return 403 |

Also outstanding, from the original survey:

- No dedicated **parliamentary resolution** (Országgyűlési határozat) on AI was
  found. The central parliamentary material is bill T/12632 and its debates.
- No official 2026 document repeals or updates the 2025–2030 strategy. Watch
  kormany.hu and njt.jog.gov.hu.
- The 2025 public-consultation drafts were published on kormany.hu under
  *Jogszabálytervezetek* and appear to have been removed after adoption.

## Secondary sources

Not official, not archived here — useful for orientation:

- [Regulations.ai — Hungary](https://regulations.ai/regulations/hungary-summary)
- [CMS Expert Guide — Hungary](https://cms.law/en/int/expert-guides/ai-regulation-scanner/hungary)
- [Bird & Bird AI regulatory tracker — Hungary](https://www.twobirds.com/en/capabilities/artificial-intelligence/ai-legal-services/ai-regulatory-horizon-tracker/hungary)
- [Analysis of the 2026 supervisory change](https://gdpr.blog.hu/2026/09/02/new_set-up_in_the_supervision_of_ai_systems_in_hungary)
