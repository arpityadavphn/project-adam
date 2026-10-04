(() => {

  const NODE = "D04_POST_APPLY_ROUTER";

  // =========================================================
  // HELPERS
  // =========================================================

  const clean = s =>
    (s || "")
      .replace(/\s+/g, " ")
      .trim();

  const textOf = el =>
    clean(
      el?.innerText ||
      el?.textContent ||
      ""
    );

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


  // =========================================================
  // INPUT
  // =========================================================

  const d03 =
    window.ADAM_D03 || null;


  if (
    !d03 ||
    d03.state !== "APPLY_TRIGGERED"
  ) {

    const result = {

      node: NODE,

      success: false,

      state:
        "INVALID_INPUT_STATE",

      reason:
        "D04 requires successful D03 APPLY_TRIGGERED result",

      nextNode:
        "D03_APPLY_TRIGGER"

    };


    window.ADAM_D04 =
      result;


    console.error(
      "❌ D04 requires successful D03 first"
    );


    return result;

  }


  // =========================================================
  // PAGE SNAPSHOT
  // =========================================================

  const bodyText =
    clean(
      document.body.innerText
    );

  const lowerText =
    bodyText.toLowerCase();


  // =========================================================
  // VISIBLE FORM CONTROLS
  // =========================================================

  const radios =
    [
      ...document.querySelectorAll(
        'input[type="radio"]'
      )
    ].filter(visible);


  const checkboxes =
    [
      ...document.querySelectorAll(
        'input[type="checkbox"]'
      )
    ].filter(visible);


  const textInputs =
    [
      ...document.querySelectorAll(
        `
        input[type="text"],
        input[type="number"],
        input[type="email"],
        input:not([type])
        `
      )
    ].filter(visible);


  const textareas =
    [
      ...document.querySelectorAll(
        "textarea"
      )
    ].filter(visible);


  const selects =
    [
      ...document.querySelectorAll(
        "select"
      )
    ].filter(visible);


  // =========================================================
  // VISIBLE ACTIONS
  // =========================================================

  const actions =
    [
      ...document.querySelectorAll(
        `
        button,
        [role="button"],
        input[type="submit"],
        input[type="button"]
        `
      )
    ]
    .filter(visible)
    .map(el => ({

      element:
        el,

      text:
        textOf(el),

      tag:
        el.tagName,

      class:
        typeof el.className === "string"
          ? el.className
          : "",

      disabled:
        el.disabled === true ||
        el.getAttribute("aria-disabled") === "true"

    }))
    .filter(x =>
      x.text.length > 0
    );


  const saveAction =
    actions.find(x =>
      /^save$/i.test(x.text)
    );


  const nextAction =
    actions.find(x =>
      /^(next|continue)$/i.test(x.text)
    );


  const submitAction =
    actions.find(x =>
      /^(submit|apply|finish)$/i.test(x.text)
    );


  // =========================================================
  // SPECIAL STATES
  // =========================================================

  const captchaDetected =

    lowerText.includes("captcha")

    ||

    !!document.querySelector(
      'iframe[src*="captcha"], iframe[src*="recaptcha"]'
    );


  const loginDetected =

    /login|signin|sign-in/i.test(
      location.pathname
    )

    ||

    (
      lowerText.includes("login") &&
      lowerText.includes("password")
    );


  // =========================================================
  // QUESTIONNAIRE SIGNALS
  // =========================================================

  const questionnaireText =

    lowerText.includes(
      "recruiter's questions"
    )

    ||

    lowerText.includes(
      "recruiter questions"
    )

    ||

    lowerText.includes(
      "answer all"
    )

    ||

    lowerText.includes(
      "successfully apply for the job"
    );


  const fieldCount =

    radios.length +

    checkboxes.length +

    textInputs.length +

    textareas.length +

    selects.length;


  const questionnaireDetected =

    questionnaireText

    ||

    (
      fieldCount > 0 &&
      !!(
        saveAction ||
        nextAction ||
        submitAction
      )
    );


  // =========================================================
  // SUCCESS SIGNALS
  // =========================================================

  const successDetected =

    lowerText.includes(
      "successfully applied"
    )

    ||

    lowerText.includes(
      "application submitted"
    )

    ||

    lowerText.includes(
      "application has been submitted"
    )

    ||

    lowerText.includes(
      "you have applied"
    );


  // =========================================================
  // EXTERNAL APPLICATION SIGNAL
  // =========================================================

  let externalDetected =
    false;

  let externalUrl =
    null;


  if (
    d03.popupUrl
  ) {

    try {

      const popup =
        new URL(
          d03.popupUrl,
          location.origin
        );


      externalDetected =
        popup.hostname !==
        location.hostname;


      if (externalDetected)
        externalUrl = popup.href;

    } catch {}

  }


  // =========================================================
  // ROUTING
  // =========================================================

  let state =
    "UNKNOWN_POST_APPLY_STATE";

  let reason =
    "No known post-Apply state matched";

  let nextNode =
    "D10_EXCEPTION_INSPECTOR";


  if (captchaDetected) {

    state =
      "CAPTCHA_REQUIRED";

    reason =
      "CAPTCHA/challenge detected";

    nextNode =
      "D10_EXCEPTION_INSPECTOR";

  }


  else if (loginDetected) {

    state =
      "LOGIN_REQUIRED";

    reason =
      "Authentication required";

    nextNode =
      "D10_EXCEPTION_INSPECTOR";

  }


  else if (externalDetected) {

    state =
      "EXTERNAL_APPLICATION";

    reason =
      "Application opened outside Naukri";

    nextNode =
      "EXTERNAL_HANDLER";

  }


  else if (questionnaireDetected) {

    state =
      "QUESTIONS_PRESENT";

    reason =
      "Recruiter questionnaire detected";

    nextNode =
      "D05_QUESTION_INSPECTOR";

  }


  else if (successDetected) {

    state =
      "APPLIED_DIRECTLY";

    reason =
      "Application success confirmation detected";

    nextNode =
      "D09_COMPLETION_VERIFIER";

  }


  // =========================================================
  // RESULT CONTRACT
  // =========================================================

  const result = {

    node:
      NODE,

    success:
      state !==
      "UNKNOWN_POST_APPLY_STATE",

    timestamp:
      new Date().toISOString(),

    job:
      d03.job,

    state,

    reason,

    questionnaire: {

      detected:
        questionnaireDetected,

      fieldCount,

      radioCount:
        radios.length,

      checkboxCount:
        checkboxes.length,

      textInputCount:
        textInputs.length,

      textareaCount:
        textareas.length,

      selectCount:
        selects.length,

      saveVisible:
        !!saveAction,

      saveDisabled:
        saveAction?.disabled ?? null,

      nextVisible:
        !!nextAction,

      submitVisible:
        !!submitAction

    },

    external: {

      detected:
        externalDetected,

      url:
        externalUrl

    },

    nextNode,

    error:
      state ===
      "UNKNOWN_POST_APPLY_STATE"

        ? "Unable to classify post-Apply state"

        : null

  };


  // =========================================================
  // SAVE FOR NEXT NODE
  // =========================================================

  window.ADAM_D04 =
    result;


  window.ADAM_D04_CONTROLS = {

    radios,

    checkboxes,

    textInputs,

    textareas,

    selects,

    actions

  };


  // =========================================================
  // OUTPUT
  // =========================================================

  console.log(
    "%cPROJECT ADAM — D04",
    "font-size:16px;font-weight:bold"
  );


  console.log(
    "State:",
    state
  );


  console.log(
    "Reason:",
    reason
  );


  console.log(
    "Next Node:",
    nextNode
  );


  console.table([
    {

      state,

      fields:
        fieldCount,

      radios:
        radios.length,

      checkboxes:
        checkboxes.length,

      textInputs:
        textInputs.length,

      textareas:
        textareas.length,

      selects:
        selects.length,

      saveVisible:
        !!saveAction,

      saveDisabled:
        saveAction?.disabled ?? null,

      nextNode

    }
  ]);


  console.log(
    "Visible actions:"
  );


  console.table(

    actions.map(
      (x, i) => ({

        i,

        text:
          x.text,

        tag:
          x.tag,

        class:
          x.class,

        disabled:
          x.disabled

      })
    )

  );


  console.log(
    "Full result:",
    result
  );


  return result;

})();