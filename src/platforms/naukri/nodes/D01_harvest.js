// ============================================================
// PROJECT ADAM
// D01 — NAUKRI JOB HARVEST
// ============================================================
//
// Purpose:
// Harvest job URLs from Naukri Recommended Jobs.
//
// Input:
//   Playwright Page
//
// Output:
// {
//   node: "D01_HARVEST",
//   success: true,
//   state: "JOBS_HARVESTED",
//   jobs: [...],
//   count: N,
//   nextNode: "D02_JOB_STATE_INSPECTOR",
//   error: null
// }
//
// Important:
// Naukri job titles are NOT normal <a> links.
// Clicking them calls window.open(...).
//
// We intercept window.open temporarily, click each title,
// capture the generated job URL, then restore window.open.
//
// ============================================================


const TITLE_SELECTOR =
  "p.title.ellipsis.typ-16Bold";


async function runD01(
  page,
  options = {}
) {

  const {

    testLimit = Infinity,

    clickDelayMs = 200

  } = options;


  console.log(
    "\n============================================================"
  );

  console.log(
    "D01 — HARVEST NAUKRI JOBS"
  );

  console.log(
    "============================================================"
  );


  try {

    // --------------------------------------------------------
    // 1. Make sure page is usable
    // --------------------------------------------------------

    await page.waitForLoadState(
      "domcontentloaded"
    );


    await page.waitForSelector(
      TITLE_SELECTOR,
      {
        state: "attached",
        timeout: 30000
      }
    );


    // --------------------------------------------------------
    // 2. Execute proven browser-side harvesting logic
    // --------------------------------------------------------

    const result =
      await page.evaluate(
        async ({
          selector,
          requestedLimit,
          clickDelayMs
        }) => {

          const sleep =
            ms =>
              new Promise(
                resolve =>
                  setTimeout(
                    resolve,
                    ms
                  )
              );


          const clean =
            value =>
              String(
                value || ""
              )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim();


          // ==================================================
          // GET VISIBLE JOB TITLES
          // ==================================================

          const titleElements = [

            ...document
              .querySelectorAll(
                selector
              )

          ]
          .filter(
            el => {

              const rect =
                el.getBoundingClientRect();


              return (

                rect.width > 0 &&

                rect.height > 0 &&

                clean(
                  el.innerText
                )

              );

            }
          );


          // ==================================================
          // INTERCEPT window.open
          // ==================================================

          const originalOpen =
            window.open;


          let activeJob =
            null;


          const captured =
            [];


          window.open =
            function(
              url,
              ...args
            ) {

              if (!url) {

                return null;

              }


              try {

                const parsed =
                  new URL(
                    url,
                    location.origin
                  );


                if (
                  parsed.pathname
                    .startsWith(
                      "/job-listings-"
                    )
                ) {

                  const match =
                    parsed.pathname.match(
                      /-(\d{10,})\/?$/
                    );


                  captured.push({

                    index:
                      activeJob?.index ??
                      null,

                    title:
                      activeJob?.title ??
                      "",

                    jobId:
                      match?.[1] ||
                      null,

                    url:
                      parsed.origin +
                      parsed.pathname,

                    fullUrl:
                      parsed.href

                  });

                }

              }

              catch (
                error
              ) {

                console.warn(
                  "D01 URL parsing error:",
                  error
                );

              }


              // Prevent popup / new tab.
              return null;

            };


          // ==================================================
          // CLICK JOB TITLES
          // ==================================================

          try {

            const limit =

              requestedLimit === null

                ? titleElements.length

                : Math.min(
                    requestedLimit,
                    titleElements.length
                  );


            for (
              let i = 0;
              i < limit;
              i++
            ) {

              const el =
                titleElements[i];


              activeJob = {

                index:
                  i,

                title:
                  clean(
                    el.innerText
                  )

              };


              // Bring element into view first.
              el.scrollIntoView({
                block: "center",
                inline: "nearest"
              });


              await sleep(
                50
              );


              el.click();


              await sleep(
                clickDelayMs
              );

            }

          }


          finally {

            // Very important:
            // always restore original browser behavior.

            window.open =
              originalOpen;

          }


          // ==================================================
          // DEDUPLICATE
          // ==================================================

          const seen =
            new Set();


          const jobs =
            captured
              .filter(
                job => {

                  if (
                    !job.url ||
                    seen.has(
                      job.url
                    )
                  ) {

                    return false;

                  }


                  seen.add(
                    job.url
                  );


                  return true;

                }
              );


          return {

            titleElementsFound:
              titleElements.length,

            capturedBeforeDedup:
              captured.length,

            jobs

          };

        },

        {

          selector:
            TITLE_SELECTOR,

          requestedLimit:
            Number.isFinite(
              testLimit
            )
              ? testLimit
              : null,

          clickDelayMs

        }
      );


    // --------------------------------------------------------
    // 3. Validate result
    // --------------------------------------------------------

    if (
      !result.jobs.length
    ) {

      return {

        node:
          "D01_HARVEST",

        success:
          false,

        state:
          "NO_JOBS_CAPTURED",

        jobs:
          [],

        count:
          0,

        diagnostics: {

          titleElementsFound:
            result.titleElementsFound,

          capturedBeforeDedup:
            result.capturedBeforeDedup

        },

        nextNode:
          null,

        error:
          "Job titles were found but no valid Naukri job URLs were captured."

      };

    }


    // --------------------------------------------------------
    // 4. Production result
    // --------------------------------------------------------

    const output = {

      node:
        "D01_HARVEST",

      success:
        true,

      state:
        "JOBS_HARVESTED",

      jobs:
        result.jobs,

      count:
        result.jobs.length,

      diagnostics: {

        titleElementsFound:
          result.titleElementsFound,

        capturedBeforeDedup:
          result.capturedBeforeDedup

      },

      nextNode:
        "D02_JOB_STATE_INSPECTOR",

      error:
        null

    };


    console.log(
      `✅ D01 captured ${output.count} unique jobs`
    );


    console.log(
      `Titles found: ${result.titleElementsFound}`
    );


    console.log(
      `Raw URLs captured: ${result.capturedBeforeDedup}`
    );


    console.table(

      output.jobs.map(
        job => ({

          index:
            job.index,

          jobId:
            job.jobId,

          title:
            job.title,

          url:
            job.url

        })
      )

    );


    return output;

  }


  catch (
    error
  ) {

    console.error(
      "❌ D01 FAILED:",
      error.message
    );


    return {

      node:
        "D01_HARVEST",

      success:
        false,

      state:
        "D01_FAILED",

      jobs:
        [],

      count:
        0,

      nextNode:
        null,

      error:
        error.message

    };

  }

}


module.exports = {

  runD01,

  TITLE_SELECTOR

};
