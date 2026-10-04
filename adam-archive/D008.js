// ============================================================
// PROJECT ADAM — D08 APPLICATION OUTCOME INSPECTOR
// FINAL v1.0
//
// DEPENDS ON:
//   D07_COMMIT_ANSWER
//
// D07 contract:
//   success = true
//   state   = "COMMIT_TRIGGERED"
//
// D07 handoff can come from:
//   1. window.ADAM_D07              same-page transition
//   2. sessionStorage               after full navigation
//
// OUTPUT:
//   window.ADAM_D08
//
// ROUTES:
//   QUESTIONS_PRESENT     -> D05_QUESTION_INSPECTOR
//   APPLICATION_SUCCESS   -> NEXT_JOB
//   ALREADY_APPLIED       -> NEXT_JOB
//   JOB_CLOSED            -> NEXT_JOB
//   LOGIN_REQUIRED        -> D10_EXCEPTION_INSPECTOR
//   CAPTCHA_REQUIRED      -> D10_EXCEPTION_INSPECTOR
//   APPLICATION_ERROR     -> D10_EXCEPTION_INSPECTOR
//   APPLICATION_INCOMPLETE-> D10_EXCEPTION_INSPECTOR
// ============================================================


window.ADAM_RUN_D08 =
async function() {

  const NODE =
    "D08_APPLICATION_OUTCOME_INSPECTOR";


  // ============================================================
  // CONFIG
  // ============================================================

  const MAX_WAIT_MS = 8000;
  const POLL_MS = 250;


  // ============================================================
  // HELPERS
  // ============================================================

  const sleep = ms =>
    new Promise(resolve =>
      setTimeout(resolve, ms)
    );


  const clean = s =>
    (s || "")
      .replace(/\s+/g, " ")
      .trim();


  const visible = el => {

    if (!el)
      return false;


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


  // ============================================================
  // 1. RESTORE D07 HANDOFF
  // ============================================================

  let d07 =
    window.ADAM_D07 ||
    null;


  let handoffSource =
    d07
      ? "WINDOW"
      : null;


  // D07 may have caused:
  //
  // /job-listings-...
  //        ↓
  // /myapply/saveApply...
  //
  // which destroys window.ADAM_D07.

  if (!d07) {

    try {

      const saved =
        sessionStorage.getItem(
          "ADAM_D07_HANDOFF"
        );


      if (saved) {

        d07 =
          JSON.parse(saved);

        handoffSource =
          "SESSION_STORAGE";

      }

    }

    catch (error) {

      console.warn(
        "⚠️ Could not restore D07 handoff:",
        error
      );

    }

  }


  // ============================================================
  // 2. VALIDATE D07
  // ============================================================

  if (!d07) {

    const result = {

      node:
        NODE,

      success:
        false,

      state:
        "INVALID_INPUT_STATE",

      reason:
        "D08 requires D07 handoff",

      previousNode:
        null,

      previousState:
        null,

      job:
        null,

      nextNode:
        "D07_COMMIT_ANSWER",

      error:
        "D07 handoff not found"

    };


    window.ADAM_D08 =
      result;


    console.error(
      "❌ D08: D07 handoff not found"
    );


    return result;

  }


  if (
    d07.success !== true ||
    d07.state !== "COMMIT_TRIGGERED"
  ) {

    const result = {

      node:
        NODE,

      success:
        false,

      state:
        "INVALID_INPUT_STATE",

      reason:
        `Expected D07 COMMIT_TRIGGERED, received ${d07.state}`,

      previousNode:
        d07.node || null,

      previousState:
        d07.state || null,

      job:
        d07.job || null,

      nextNode:
        "D10_EXCEPTION_INSPECTOR",

      error:
        d07.error ||
        "Invalid D07 state"

    };


    window.ADAM_D08 =
      result;


    console.error(
      "❌ D08 invalid upstream state:",
      d07.state
    );


    return result;

  }


  // ============================================================
  // PREVIOUS QUESTION
  //
  // Important:
  // We use this to make sure the old question has actually
  // changed before reporting QUESTIONS_PRESENT.
  // ============================================================

  const previousQuestion =
    clean(
      d07.question?.text ||
      ""
    );


  // ============================================================
  // 3. APPLICATION ROOT
  // ============================================================

  function getAppRoot() {

    return (

      document.querySelector(
        "._chatBotContainer"
      )

      ||

      document.querySelector(
        ".chatbot_Drawer.chatbot_right"
      )

      ||

      document.querySelector(
        ".chatbot_Drawer"
      )

      ||

      null

    );

  }


  // ============================================================
  // 4. EXTRACT CURRENT QUESTION
  //
  // Lightweight version of D05.
  //
  // D08 only needs to know:
  // "Did a NEW question appear?"
  //
  // D05 will perform full inspection afterward.
  // ============================================================

  function inspectCurrentQuestion() {

    const root =
      getAppRoot();


    if (
      !root ||
      !visible(root)
    ) {

      return {

        present:
          false,

        text:
          "",

        controls:
          0

      };

    }


    const controls = [

      ...root.querySelectorAll(
        `
        input[type="radio"],
        input[type="checkbox"],
        input[type="text"],
        input[type="number"],
        input[type="email"],
        textarea,
        select
        `
      )

    ].filter(visible);


    if (!controls.length) {

      return {

        present:
          false,

        text:
          "",

        controls:
          0

      };

    }


    const firstControl =
      controls[0];


    const controlRect =
      firstControl.getBoundingClientRect();


    let candidates = [

      ...root.querySelectorAll(
        `
        p,
        span,
        div,
        label,
        h1,
        h2,
        h3,
        h4
        `
      )

    ]

      .filter(visible)

      .map(el => {

        const rect =
          el.getBoundingClientRect();


        return {

          text:
            clean(el.innerText),

          gap:
            controlRect.top -
            rect.bottom

        };

      })

      .filter(item => {

        if (
          !item.text ||
          item.text.length < 5 ||
          item.text.length > 300
        ) {
          return false;
        }


        if (
          item.gap < -10 ||
          item.gap > 350
        ) {
          return false;
        }


        const lower =
          item.text.toLowerCase();


        if (
          lower === "yes" ||
          lower === "no" ||
          lower === "save" ||
          lower === "try again" ||

          lower.includes(
            "thank you for showing interest"
          ) ||

          lower.includes(
            "kindly answer all the recruiter's questions"
          )
        ) {
          return false;
        }


        return true;

      });


    candidates =
      candidates.map(item => {

        let score = 0;


        if (
          item.text.includes("?")
        ) {
          score += 1000;
        }


        score +=
          Math.max(
            0,
            300 -
            Math.abs(item.gap)
          );


        if (
          item.text.length < 150
        ) {
          score += 100;
        }


        return {

          ...item,

          score

        };

      });


    candidates.sort(
      (a, b) =>
        b.score -
        a.score
    );


    return {

      present:
        true,

      text:
        candidates[0]?.text ||
        "",

      controls:
        controls.length

    };

  }


  // ============================================================
  // 5. CLASSIFY CURRENT PAGE
  // ============================================================

  function inspectState() {

    const bodyText =
      clean(
        document.body.innerText
      );


    const lower =
      bodyText.toLowerCase();


    const pathname =
      location.pathname;


    // ----------------------------------------------------------
    // LOGIN
    // ----------------------------------------------------------

    const loginRequired =

      /login|signin|sign-in/i
        .test(pathname)

      ||

      (
        lower.includes("login") &&
        lower.includes("password")
      );


    // ----------------------------------------------------------
    // CAPTCHA
    // ----------------------------------------------------------

    const captchaRequired =

      lower.includes("captcha")

      ||

      !!document.querySelector(
        `
        iframe[src*="captcha"],
        iframe[src*="recaptcha"]
        `
      );


    // ----------------------------------------------------------
    // SUCCESS
    //
    // Actual certified Naukri message:
    //
    // Applied to "Business Analyst"
    // ----------------------------------------------------------

    const appliedToMatch =
      bodyText.match(
        /Applied to\s+["“]?([^"\n”]+)["”]?/i
      );


    const appliedRole =
      appliedToMatch?.[1]
        ?.trim() ||
      null;


    const successDetected =

      !!appliedToMatch

      ||

      /successfully applied/i
        .test(bodyText)

      ||

      /application submitted successfully/i
        .test(bodyText)

      ||

      /your application has been submitted/i
        .test(bodyText)

      ||

      /you have successfully applied/i
        .test(bodyText);


    // ----------------------------------------------------------
    // INCOMPLETE
    // ----------------------------------------------------------

    const incompleteDetected =

      /application was not accepted due to incomplete information/i
        .test(bodyText)

      ||

      /answer all mandatory questions/i
        .test(bodyText)

      ||

      /mandatory questions when reapplying/i
        .test(bodyText);


    // ----------------------------------------------------------
    // APPLICATION ERROR
    // ----------------------------------------------------------

    const errorDetected =

      /something went wrong/i
        .test(bodyText)

      ||

      /please try again later/i
        .test(bodyText)

      ||

      /unable to process your request/i
        .test(bodyText);


    // ----------------------------------------------------------
    // ALREADY APPLIED
    // ----------------------------------------------------------

    const alreadyAppliedDetected =

      /already applied/i
        .test(bodyText)

      ||

      /you have already applied/i
        .test(bodyText);


    // ----------------------------------------------------------
    // JOB CLOSED
    // ----------------------------------------------------------

    const closedDetected =

      /job has expired/i
        .test(bodyText)

      ||

      /this job has expired/i
        .test(bodyText)

      ||

      /this job is no longer available/i
        .test(bodyText);


    // ----------------------------------------------------------
    // QUESTION
    // ----------------------------------------------------------

    const currentQuestion =
      inspectCurrentQuestion();


    const newQuestionDetected =

      currentQuestion.present

      &&

      currentQuestion.text

      &&

      (
        !previousQuestion

        ||

        clean(
          currentQuestion.text
        ) !==
        previousQuestion
      );


    // ==========================================================
    // ROUTING PRIORITY
    // ==========================================================

    if (captchaRequired) {

      return {

        recognised:
          true,

        state:
          "CAPTCHA_REQUIRED",

        reason:
          "CAPTCHA / verification challenge detected",

        nextNode:
          "D10_EXCEPTION_INSPECTOR",

        appliedRole,

        currentQuestion

      };

    }


    if (loginRequired) {

      return {

        recognised:
          true,

        state:
          "LOGIN_REQUIRED",

        reason:
          "Naukri authentication required",

        nextNode:
          "D10_EXCEPTION_INSPECTOR",

        appliedRole,

        currentQuestion

      };

    }


    if (successDetected) {

      return {

        recognised:
          true,

        state:
          "APPLICATION_SUCCESS",

        reason:
          appliedRole

            ? `Applied to "${appliedRole}"`

            : "Application success confirmation detected",

        nextNode:
          "NEXT_JOB",

        appliedRole,

        currentQuestion

      };

    }


    if (incompleteDetected) {

      return {

        recognised:
          true,

        state:
          "APPLICATION_INCOMPLETE",

        reason:
          "Mandatory application information is incomplete",

        nextNode:
          "D10_EXCEPTION_INSPECTOR",

        appliedRole,

        currentQuestion

      };

    }


    if (errorDetected) {

      return {

        recognised:
          true,

        state:
          "APPLICATION_ERROR",

        reason:
          "Naukri application error detected",

        nextNode:
          "D10_EXCEPTION_INSPECTOR",

        appliedRole,

        currentQuestion

      };

    }


    if (alreadyAppliedDetected) {

      return {

        recognised:
          true,

        state:
          "ALREADY_APPLIED",

        reason:
          "Job already applied",

        nextNode:
          "NEXT_JOB",

        appliedRole,

        currentQuestion

      };

    }


    if (closedDetected) {

      return {

        recognised:
          true,

        state:
          "JOB_CLOSED",

        reason:
          "Job closed or expired",

        nextNode:
          "NEXT_JOB",

        appliedRole,

        currentQuestion

      };

    }


    // IMPORTANT:
    //
    // Only classify QUESTIONS_PRESENT when the question
    // has changed from the one D07 just submitted.

    if (newQuestionDetected) {

      return {

        recognised:
          true,

        state:
          "QUESTIONS_PRESENT",

        reason:
          "New recruiter question detected",

        nextNode:
          "D05_QUESTION_INSPECTOR",

        appliedRole,

        currentQuestion

      };

    }


    // Old question still visible.
    // Naukri may simply still be processing the Save.

    return {

      recognised:
        false,

      state:
        "WAITING_FOR_TRANSITION",

      reason:
        "Waiting for Naukri to process committed answer",

      nextNode:
        null,

      appliedRole,

      currentQuestion

    };

  }


  // ============================================================
  // 6. WAIT FOR NAUKRI TRANSITION
  // ============================================================

  console.log(
    "%cPROJECT ADAM — D08",
    "font-size:16px;font-weight:bold"
  );


  console.log(
    "Previous:",
    `${d07.node} → ${d07.state}`
  );


  console.log(
    "Handoff:",
    handoffSource
  );


  if (previousQuestion) {

    console.log(
      "Previous question:",
      previousQuestion
    );

  }


  const started =
    Date.now();


  let inspection =
    null;


  while (
    Date.now() -
    started <
    MAX_WAIT_MS
  ) {

    inspection =
      inspectState();


    if (
      inspection.recognised
    ) {
      break;
    }


    await sleep(
      POLL_MS
    );

  }


  // ============================================================
  // 7. TIMEOUT
  // ============================================================

  if (
    !inspection ||
    !inspection.recognised
  ) {

    inspection = {

      recognised:
        false,

      state:
        "UNKNOWN_APPLICATION_OUTCOME",

      reason:
        "No recognised state appeared after commit within timeout",

      nextNode:
        "D10_EXCEPTION_INSPECTOR",

      appliedRole:
        null,

      currentQuestion:
        inspectCurrentQuestion()

    };

  }


  // ============================================================
  // 8. RESULT CONTRACT
  // ============================================================

  const result = {

    node:
      NODE,

    success:
      inspection.recognised,

    timestamp:
      new Date().toISOString(),


    // ----------------------------------------------------------
    // NODE CHAIN
    // ----------------------------------------------------------

    previousNode:
      d07.node,

    previousState:
      d07.state,

    handoffSource,


    // ----------------------------------------------------------
    // CARRY JOB
    // ----------------------------------------------------------

    job:
      d07.job ||
      null,


    // ----------------------------------------------------------
    // CARRY LAST QUESTION/ANSWER
    // ----------------------------------------------------------

    committed: {

      question:
        d07.question ||
        null,

      answer:
        d07.answer ||
        null

    },


    // ----------------------------------------------------------
    // OUTCOME
    // ----------------------------------------------------------

    state:
      inspection.state,

    reason:
      inspection.reason,


    application: {

      appliedRole:
        inspection.appliedRole,

      nextQuestion:
        inspection.state ===
        "QUESTIONS_PRESENT"

          ? inspection.currentQuestion.text

          : null,

      visibleControls:
        inspection.currentQuestion?.controls ||
        0

    },


    page: {

      url:
        location.href,

      pathname:
        location.pathname,

      title:
        document.title

    },


    nextNode:
      inspection.nextNode,


    error:

      inspection.recognised

        ? null

        : "Unable to classify post-commit state"

  };


  // ============================================================
  // 9. SAVE OUTPUT
  // ============================================================

  window.ADAM_D08 =
    result;


  // ============================================================
  // 10. OUTPUT
  // ============================================================

  console.log(
    "State:",
    result.state
  );


  console.log(
    "Reason:",
    result.reason
  );


  console.log(
    "Next Node:",
    result.nextNode
  );


  console.table([
    {

      state:
        result.state,

      role:
        result.application
          .appliedRole,

      nextQuestion:
        result.application
          .nextQuestion,

      controls:
        result.application
          .visibleControls,

      nextNode:
        result.nextNode

    }
  ]);


  console.log(
    "Full result:",
    result
  );


  return result;

};