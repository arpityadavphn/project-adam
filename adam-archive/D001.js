//Extract Naukri Jobs

(async () => {

  const TEST_LIMIT = Infinity;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const clean = s =>
    (s || "").replace(/\s+/g, " ").trim();


  // --------------------------------------------
  // 1. GET JOB TITLES
  // --------------------------------------------

  const titleElements = [
    ...document.querySelectorAll(
      "p.title.ellipsis.typ-16Bold"
    )
  ].filter(el => {

    const r = el.getBoundingClientRect();

    return (
      r.width > 0 &&
      r.height > 0 &&
      clean(el.innerText)
    );

  });


  console.log(
    `🔎 Found ${titleElements.length} job titles`
  );


  // --------------------------------------------
  // 2. INTERCEPT window.open
  // --------------------------------------------

  const originalOpen = window.open;

  let activeJob = null;

  const results = [];


  window.open = function(url, ...args) {

    if (!url) return null;

    try {

      const u = new URL(
        url,
        location.origin
      );


      // Only accept actual Naukri job URLs
      if (
        u.pathname.startsWith("/job-listings-")
      ) {

        const item = {

          index:
            activeJob?.index ?? null,

          title:
            activeJob?.title ?? "",

          url:
            u.origin + u.pathname,

          fullUrl:
            u.href

        };


        results.push(item);


        console.log(
          `🎯 ${item.title}`
        );

        console.log(
          `   ${item.url}`
        );

      }

    } catch (err) {

      console.log(
        "URL parsing error:",
        err
      );

    }


    // Prevent new tab opening
    return null;

  };


  // --------------------------------------------
  // 3. TEST FIRST 10 JOBS
  // --------------------------------------------

  try {

    const limit = Math.min(
      TEST_LIMIT,
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

        index: i,

        title:
          clean(el.innerText)

      };


      console.log(
        `👉 ${i + 1}/${limit}`,
        activeJob.title
      );


      el.click();


      await sleep(250);

    }

  }


  // --------------------------------------------
  // 4. ALWAYS RESTORE window.open
  // --------------------------------------------

  finally {

    window.open =
      originalOpen;

  }


  // --------------------------------------------
  // 5. REMOVE DUPLICATES
  // --------------------------------------------

  const seen =
    new Set();


  const unique =
    results.filter(job => {

      if (
        !job.url ||
        seen.has(job.url)
      ) {
        return false;
      }

      seen.add(job.url);

      return true;

    });


  // --------------------------------------------
  // 6. SAVE
  // --------------------------------------------

  window.NAUKRI_JOBS =
    unique;


  console.log(
    `✅ CAPTURED ${unique.length} UNIQUE JOBS`
  );


  console.table(
    unique
  );


})();

