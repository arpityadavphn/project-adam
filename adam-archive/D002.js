(() => {

  const NODE = "D02_JOB_PAGE_INSPECTOR";

  // =========================================================
  // HELPERS
  // =========================================================

  const clean = s =>
    (s || "").replace(/\s+/g, " ").trim();

  const visible = el => {
    if (!el) return false;

    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const textOf = el =>
    clean(el?.innerText || el?.textContent || "");


  // =========================================================
  // STEP 1 — VERIFY PAGE TYPE
  // =========================================================

  const pathname = location.pathname;

  const isJobDetailPage =
    pathname.startsWith("/job-listings-");


  if (!isJobDetailPage) {

    const result = {
      node: NODE,

      success: false,

      timestamp:
        new Date().toISOString(),

      state:
        "NOT_JOB_DETAIL_PAGE",

      reason:
        "Current page is not a Naukri job-detail page",

      page: {
        title:
          document.title,

        url:
          location.href,

        pathname
      },

      job: null,

      apply: {
        found: false
      },

      nextNode:
        "OPEN_JOB",

      error:
        null
    };


    window.ADAM_D02 = result;

    console.log(
      "%cPROJECT ADAM — D02",
      "font-size:16px;font-weight:bold"
    );

    console.warn(
      "⚠️ NOT A JOB DETAIL PAGE"
    );

    console.log(
      "Current URL:",
      location.href
    );

    console.log(
      "Expected pathname beginning with:",
      "/job-listings-"
    );

    console.log(
      "Result:",
      result
    );

    return result;
  }


  // =========================================================
  // STEP 2 — JOB ID
  // =========================================================

  const jobIdMatch =
    pathname.match(
      /-(\d{10,})\/?$/
    );

  const jobId =
    jobIdMatch?.[1] || null;


  // =========================================================
  // STEP 3 — TITLE
  // =========================================================

  const headingCandidates = [
    ...document.querySelectorAll(
      "h1, [class*='jd-header-title'], [class*='job-title']"
    )
  ].filter(visible);


  const titleEl =
    headingCandidates.find(el => {

      const txt =
        textOf(el);

      return (
        txt.length >= 3 &&
        txt.length <= 200
      );

    });


  const title =
    textOf(titleEl);


  // =========================================================
  // STEP 4 — COMPANY
  // =========================================================

  const companySelectors = [

    "[class*='jd-header-comp-name']",

    "[class*='company-name']",

    "[class*='comp-name']",

    "[class*='company'] a"

  ];


  let company = "";


  for (const selector of companySelectors) {

    const elements =
      [...document.querySelectorAll(selector)]
        .filter(visible);


    const candidate =
      elements.find(el => {

        const txt =
          textOf(el);

        return (
          txt.length > 1 &&
          txt.length < 150 &&
          !/reviews?/i.test(txt)
        );

      });


    if (candidate) {

      company =
        textOf(candidate);

      break;

    }

  }


  // =========================================================
  // STEP 5 — INTERACTIVE CONTROLS
  // =========================================================

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


  const applyCandidates =
    interactive.filter(el => {

      const txt =
        textOf(el)
          .toLowerCase();

      return (
        txt === "apply" ||
        txt === "apply now" ||
        txt === "apply on company site" ||
        txt === "apply on company website"
      );

    });


  const applyEl =
    applyCandidates[0] || null;


  // =========================================================
  // STEP 6 — PAGE STATE
  // =========================================================

  const bodyText =
    clean(document.body.innerText)
      .toLowerCase();


  let state =
    "UNKNOWN";

  let reason =
    "No known job state matched";

  let nextNode =
    "D10_EXCEPTION_INSPECTOR";


  if (
    bodyText.includes("already applied") ||
    bodyText.includes("you have applied") ||
    bodyText.includes("application submitted")
  ) {

    state =
      "ALREADY_APPLIED";

    reason =
      "Existing application detected";

    nextNode =
      "COMPLETE";

  }

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
      "Closed/expired job detected";

    nextNode =
      "COMPLETE";

  }

  else if (applyEl) {

    const href =
      applyEl.href ||
      applyEl.getAttribute("href") ||
      null;


    let external = false;


    if (href) {

      try {

        const target =
          new URL(
            href,
            location.origin
          );

        external =
          target.hostname !==
          location.hostname;

      } catch {}

    }


    if (external) {

      state =
        "EXTERNAL_APPLICATION";

      reason =
        "Apply control points outside Naukri";

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


  // =========================================================
  // STEP 7 — STANDARD OUTPUT
  // =========================================================

  const result = {

    node: NODE,

    success:
      state !== "UNKNOWN",

    timestamp:
      new Date().toISOString(),

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
        location.href

    },

    state,

    reason,

    apply: {

      found:
        !!applyEl,

      text:
        textOf(applyEl),

      tag:
        applyEl?.tagName ||
        null,

      class:
        typeof applyEl?.className === "string"
          ? applyEl.className
          : null,

      href:
        applyEl?.href ||
        applyEl?.getAttribute?.("href") ||
        null,

      candidateCount:
        applyCandidates.length

    },

    nextNode,

    error:
      state === "UNKNOWN"
        ? "Unable to determine job state"
        : null

  };


  window.ADAM_D02 =
    result;

  window.ADAM_D02_APPLY_ELEMENT =
    applyEl;


  // =========================================================
  // OUTPUT
  // =========================================================

  console.log(
    "%cPROJECT ADAM — D02 v0.2",
    "font-size:16px;font-weight:bold"
  );


  console.table([
    {
      jobId:
        result.job.jobId,

      title:
        result.job.title,

      company:
        result.job.company,

      state:
        result.state,

      applyFound:
        result.apply.found,

      applyText:
        result.apply.text,

      nextNode:
        result.nextNode
    }
  ]);


  console.log(
    "Full result:",
    result
  );


  if (state === "UNKNOWN") {

    console.warn(
      "⚠️ UNKNOWN JOB STATE"
    );

    console.table(

      interactive
        .map((el, i) => ({

          i,

          tag:
            el.tagName,

          text:
            textOf(el)
              .slice(0, 100),

          class:
            typeof el.className === "string"
              ? el.className
              : "",

          href:
            el.href ||
            el.getAttribute("href") ||
            ""

        }))
        .filter(x => x.text)

    );

  }


  return result;

})();