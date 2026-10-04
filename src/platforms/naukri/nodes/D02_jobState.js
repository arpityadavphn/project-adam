// ============================================================
// PROJECT ADAM
// D02 — NAUKRI JOB STATE INSPECTOR
// ============================================================
//
// Responsibility:
//
// 1. Verify current page is a Naukri job-detail page
// 2. Verify job ID matches the job harvested by D01
// 3. Detect job state
// 4. Detect native Apply control
// 5. Route to the appropriate next node
//
// IMPORTANT:
// D02 deliberately does NOT guess company name.
// D03 / apply-workflow will provide authoritative companyName.
//
// ============================================================


async function runD02(
  page,
  harvestedJob = null
) {

  const NODE =
    "D02_JOB_STATE_INSPECTOR";


  console.log(
    "\n============================================================"
  );

  console.log(
    "D02 — JOB STATE INSPECTOR"
  );

  console.log(
    "============================================================"
  );


  try {

    // ========================================================
    // 1. BASIC PAGE LOAD
    // ========================================================

    await page.waitForLoadState(
      "domcontentloaded"
    );


    // ========================================================
    // 2. WAIT FOR JOB PAGE HYDRATION
    //
    // Naukri may render the page shell before the actual
    // Apply button / job state appears.
    // ========================================================

    try {

      await page.waitForFunction(
        () => {

          const clean =
            value =>
              String(value || "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();


          const visible =
            el => {

              if (!el) {
                return false;
              }


              const style =
                getComputedStyle(el);

              const rect =
                el.getBoundingClientRect();


              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0
              );

            };


          const controls = [

            ...document.querySelectorAll(
              `
              button,
              a,
              [role="button"],
              input[type="button"],
              input[type="submit"]
              `
            )

          ].filter(visible);


          const hasApply =
            controls.some(
              el => {

                const text =
                  clean(
                    el.innerText ||
                    el.textContent
                  );


                return (
                  text === "apply" ||
                  text === "apply now" ||
                  text === "apply on company site" ||
                  text === "apply on company website"
                );

              }
            );


          const bodyText =
            clean(
              document.body?.innerText
            );


          const hasTerminalState =
            bodyText.includes(
              "already applied"
            ) ||
            bodyText.includes(
              "you have applied"
            ) ||
            bodyText.includes(
              "application submitted"
            ) ||
            bodyText.includes(
              "this job is no longer available"
            ) ||
            bodyText.includes(
              "job has expired"
            ) ||
            bodyText.includes(
              "this job has expired"
            );


          return (
            hasApply ||
            hasTerminalState
          );

        },
        {
          timeout: 15000
        }
      );

    }

    catch {

      console.warn(
        "⚠️ D02 hydration timeout — inspecting current DOM."
      );

    }


    // ========================================================
    // 3. INSPECT PAGE
    // ========================================================

    const result =
      await page.evaluate(
        ({
          NODE,
          harvestedJob
        }) => {

          // --------------------------------------------------
          // HELPERS
          // --------------------------------------------------

          const clean =
            value =>
              String(value || "")
                .replace(/\s+/g, " ")
                .trim();


          const visible =
            el => {

              if (!el) {
                return false;
              }


              const style =
                getComputedStyle(el);

              const rect =
                el.getBoundingClientRect();


              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0
              );

            };


          const textOf =
            el =>
              clean(
                el?.innerText ||
                el?.textContent ||
                ""
              );


          const timestamp =
            new Date()
              .toISOString();


          // ==================================================
          // PAGE TYPE
          // ==================================================

          const pathname =
            location.pathname;


          if (
            !pathname.startsWith(
              "/job-listings-"
            )
          ) {

            return {

              node:
                NODE,

              success:
                false,

              timestamp,

              state:
                "NOT_JOB_DETAIL_PAGE",

              reason:
                "Current page is not a Naukri job-detail page",

              job:
                harvestedJob ||
                null,

              apply: {
                found: false,
                candidateCount: 0
              },

              diagnostics: {
                pathname,
                currentUrl:
                  location.href
              },

              nextNode:
                "OPEN_JOB",

              error:
                null

            };

          }


          // ==================================================
          // JOB ID
          // ==================================================

          const jobId =
            pathname.match(
              /-(\d{10,})\/?$/
            )?.[1] ||
            harvestedJob?.jobId ||
            null;


          // ==================================================
          // TITLE
          // ==================================================

          const headingCandidates = [

            ...document.querySelectorAll(
              `
              h1,
              [class*="jd-header-title"],
              [class*="job-title"]
              `
            )

          ].filter(visible);


          const titleElement =
            headingCandidates.find(
              el => {

                const text =
                  textOf(el);


                return (
                  text.length >= 3 &&
                  text.length <= 200
                );

              }
            );


          const title =
            textOf(
              titleElement
            ) ||
            harvestedJob?.title ||
            "";


          // ==================================================
          // COMPANY
          //
          // Intentionally blank.
          //
          // We already proved generic page-wide company
          // selectors can accidentally capture companies from
          // recommended/related jobs.
          //
          // D03 apply-workflow response will enrich companyName.
          // ==================================================

          const company =
            harvestedJob?.company ||
            "";


          // ==================================================
          // INTERACTIVE CONTROLS
          // ==================================================

          const interactive = [

            ...document.querySelectorAll(
              `
              button,
              a,
              [role="button"],
              input[type="button"],
              input[type="submit"]
              `
            )

          ].filter(visible);


          const acceptedApplyTexts =
            new Set([
              "apply",
              "apply now",
              "apply on company site",
              "apply on company website"
            ]);


          const applyCandidates =
            interactive.filter(
              el => {

                const text =
                  textOf(el)
                    .toLowerCase();


                return acceptedApplyTexts.has(
                  text
                );

              }
            );


          const applyEl =
            applyCandidates[0] ||
            null;


          const applyText =
            textOf(
              applyEl
            );


          // ==================================================
          // PAGE STATE
          // ==================================================

          const bodyText =
            clean(
              document.body?.innerText
            )
              .toLowerCase();


          let state =
            "UNKNOWN";


          let reason =
            "No known job state matched";


          let nextNode =
            "D10_EXCEPTION_INSPECTOR";


          // --------------------------------------------------
          // Already applied
          // --------------------------------------------------

          if (
            bodyText.includes(
              "already applied"
            ) ||
            bodyText.includes(
              "you have applied"
            ) ||
            bodyText.includes(
              "application submitted"
            )
          ) {

            state =
              "ALREADY_APPLIED";

            reason =
              "Existing application detected";

            nextNode =
              "NEXT_JOB";

          }


          // --------------------------------------------------
          // Closed / expired
          // --------------------------------------------------

          else if (
            bodyText.includes(
              "this job is no longer available"
            ) ||
            bodyText.includes(
              "job has expired"
            ) ||
            bodyText.includes(
              "this job has expired"
            )
          ) {

            state =
              "JOB_CLOSED";

            reason =
              "Closed or expired job detected";

            nextNode =
              "NEXT_JOB";

          }


          // --------------------------------------------------
          // Apply available
          // --------------------------------------------------

          else if (
            applyEl
          ) {

            const normalizedApplyText =
              applyText
                .toLowerCase();


            // Text itself can tell us this is an external flow.
            let external =
              normalizedApplyText ===
                "apply on company site" ||
              normalizedApplyText ===
                "apply on company website";


            const href =
              applyEl.href ||
              applyEl.getAttribute?.(
                "href"
              ) ||
              null;


            // Also check URL if Apply is an anchor.
            if (
              !external &&
              href
            ) {

              try {

                const target =
                  new URL(
                    href,
                    location.origin
                  );


                external =
                  target.hostname !==
                  location.hostname;

              }

              catch {}

            }


            if (
              external
            ) {

              state =
                "EXTERNAL_APPLICATION";

              reason =
                "Application redirects outside Naukri";

              nextNode =
                "EXTERNAL_HANDLER";

            }

            else {

              state =
                "APPLY_AVAILABLE";

              reason =
                "Native Naukri Apply control detected";

              nextNode =
                "D03_APPLY_TRIGGER";

            }

          }


          // ==================================================
          // UNKNOWN-STATE DIAGNOSTICS
          // ==================================================

          const interactivePreview =
            state === "UNKNOWN"

              ? interactive
                  .map(
                    (el, index) => ({

                      index,

                      tag:
                        el.tagName,

                      text:
                        textOf(el)
                          .slice(
                            0,
                            120
                          ),

                      class:
                        typeof el.className ===
                        "string"
                          ? el.className
                          : "",

                      href:
                        el.href ||
                        el.getAttribute?.(
                          "href"
                        ) ||
                        ""

                    })
                  )
                  .filter(
                    item =>
                      item.text
                  )
                  .slice(
                    0,
                    50
                  )

              : [];


          // ==================================================
          // RESULT
          // ==================================================

          return {

            node:
              NODE,

            success:
              state !== "UNKNOWN",

            timestamp,

            job: {

              platform:
                "naukri",

              jobId,

              title,

              company,

              url:
                location.origin +
                location.pathname,

              fullUrl:
                location.href,

              sourceIndex:
                harvestedJob?.index ??
                null

            },

            state,

            reason,

            apply: {

              found:
                !!applyEl,

              text:
                applyText,

              tag:
                applyEl?.tagName ||
                null,

              class:
                typeof applyEl?.className ===
                "string"
                  ? applyEl.className
                  : null,

              href:
                hrefFromElement(
                  applyEl
                ),

              candidateCount:
                applyCandidates.length

            },

            diagnostics: {

              pathname,

              harvestedJobId:
                harvestedJob?.jobId ||
                null,

              jobIdMatchesHarvest:
                harvestedJob?.jobId

                  ? harvestedJob.jobId ===
                    jobId

                  : null,

              interactiveCount:
                interactive.length,

              interactivePreview

            },

            nextNode,

            error:
              state === "UNKNOWN"
                ? "Unable to determine job state"
                : null

          };


          // --------------------------------------------------
          // Local helper used above
          // --------------------------------------------------

          function hrefFromElement(
            element
          ) {

            if (!element) {
              return null;
            }


            return (
              element.href ||
              element.getAttribute?.(
                "href"
              ) ||
              null
            );

          }

        },

        {
          NODE,
          harvestedJob
        }
      );


    // ========================================================
    // 4. SAFETY CHECK — D01 JOB VS OPENED JOB
    // ========================================================

    if (
      harvestedJob?.jobId &&
      result.job?.jobId &&
      harvestedJob.jobId !==
        result.job.jobId
    ) {

      result.success =
        false;

      result.state =
        "JOB_ID_MISMATCH";

      result.reason =
        "Opened job does not match harvested D01 job";

      result.nextNode =
        "D10_EXCEPTION_INSPECTOR";

      result.error =
        `Expected ${harvestedJob.jobId}, opened ${result.job.jobId}`;

    }


    // ========================================================
    // 5. OUTPUT
    // ========================================================

    console.log(
      "\nD02 RESULT:"
    );


    console.table([
      {

        jobId:
          result.job?.jobId,

        title:
          result.job?.title,

        company:
          result.job?.company,

        state:
          result.state,

        applyFound:
          result.apply?.found,

        applyText:
          result.apply?.text,

        nextNode:
          result.nextNode

      }
    ]);


    if (
      result.state ===
      "UNKNOWN"
    ) {

      console.log(
        "\n⚠️ UNKNOWN STATE — INTERACTIVE CONTROLS:"
      );


      console.table(
        result
          .diagnostics
          ?.interactivePreview ||
        []
      );

    }


    return result;

  }


  catch (
    error
  ) {

    console.error(
      "❌ D02 FAILED:",
      error.message
    );


    return {

      node:
        NODE,

      success:
        false,

      timestamp:
        new Date()
          .toISOString(),

      job:
        harvestedJob ||
        null,

      state:
        "D02_FAILED",

      reason:
        "Unhandled D02 exception",

      apply: {
        found: false
      },

      nextNode:
        "D10_EXCEPTION_INSPECTOR",

      error:
        error.message

    };

  }

}


module.exports = {
  runD02
};