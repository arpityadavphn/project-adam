// ============================================================
// PROJECT ADAM
// D04 — POST APPLY ROUTER
// ============================================================
//
// Responsibility:
//
// Take the D03 apply result and determine what happened.
//
// Primary source of truth:
//   D03 /apply-workflow API response
//
// DOM inspection is fallback only.
//
// Routes:
//
// QUESTIONS_PRESENT
//   -> D05_QUESTION_INSPECTOR
//
// APPLICATION_SUCCESS
//   -> NEXT_JOB
//
// ALREADY_APPLIED
//   -> NEXT_JOB
//
// JOB_CLOSED
//   -> NEXT_JOB
//
// LOGIN_REQUIRED / CAPTCHA_REQUIRED / UNKNOWN
//   -> D10_EXCEPTION_INSPECTOR
//
// ============================================================


const NODE =
  "D04_POST_APPLY_ROUTER";


async function runD04(
  page,
  d03
) {

  console.log(
    "\n============================================================"
  );

  console.log(
    "D04 — POST APPLY ROUTER"
  );

  console.log(
    "============================================================"
  );


  // ==========================================================
  // 1. VALIDATE D03 INPUT
  // ==========================================================

  if (
    !d03 ||
    !d03.success ||
    d03.state !== "APPLY_TRIGGERED"
  ) {

    return failure(
      "INVALID_INPUT_STATE",
      "D04 requires successful D03 APPLY_TRIGGERED result.",
      d03?.job || null
    );

  }


  // ==========================================================
  // 2. READ D03 WORKFLOW PAYLOAD
  // ==========================================================

  const payload =
    d03.workflow?.payload ||
    null;


  const jobs =
    Array.isArray(
      payload?.jobs
    )
      ? payload.jobs
      : [];


  const apiJob =
    jobs.find(
      job =>
        String(
          job?.jobId || ""
        ) ===
        String(
          d03.job?.jobId || ""
        )
    ) ||
    jobs[0] ||
    null;


  const questionnaire =
    Array.isArray(
      apiJob?.questionnaire
    )
      ? apiJob.questionnaire
      : [];


  const questionnaireCount =
    questionnaire.length;


  const apiStatus =
    apiJob?.status ??
    null;


  const apiMessage =
    String(
      apiJob?.message || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  const apiMessageLower =
    apiMessage
      .toLowerCase();


  // ==========================================================
  // 3. WAIT BRIEFLY FOR POST-APPLY UI
  // ==========================================================

  await page.waitForTimeout(
    600
  );


  // ==========================================================
  // 4. SCOPED DOM INSPECTION
  //
  // IMPORTANT:
  // Only questionnaire controls inside Naukri chatbot drawer.
  // Do NOT inspect generic inputs across entire job page.
  // ==========================================================

  const dom =
    await page.evaluate(
      () => {

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


        const visible =
          element => {

            if (!element) {
              return false;
            }


            const style =
              getComputedStyle(
                element
              );


            const rect =
              element
                .getBoundingClientRect();


            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );

          };


        const textOf =
          element =>
            clean(
              element?.innerText ||
              element?.textContent ||
              ""
            );


        // ----------------------------------------------------
        // CHATBOT ROOT
        // ----------------------------------------------------

        const chatbotRoot =
          document.querySelector(
            "._chatBotContainer"
          ) ||
          document.querySelector(
            ".chatbot_Drawer.chatbot_right"
          ) ||
          document.querySelector(
            ".chatbot_Drawer"
          ) ||
          null;


        const rootText =
          chatbotRoot
            ? clean(
                chatbotRoot.innerText
              )
            : "";


        const rootLower =
          rootText
            .toLowerCase();


        // ----------------------------------------------------
        // QUESTION CONTROLS — CHATBOT ONLY
        // ----------------------------------------------------

        const getVisible =
          selector => {

            if (!chatbotRoot) {
              return [];
            }


            return [

              ...chatbotRoot
                .querySelectorAll(
                  selector
                )

            ].filter(
              visible
            );

          };


        const radios =
          getVisible(
            'input[type="radio"]'
          );


        const checkboxes =
          getVisible(
            'input[type="checkbox"]'
          );


        const textInputs =
          getVisible(
            `
            input[type="text"],
            input[type="number"],
            input[type="email"],
            input:not([type])
            `
          );


        const textareas =
          getVisible(
            "textarea"
          );


        const selects =
          getVisible(
            "select"
          );


        const fieldCount =
          radios.length +
          checkboxes.length +
          textInputs.length +
          textareas.length +
          selects.length;


        // ----------------------------------------------------
        // CHATBOT ACTIONS
        //
        // .sendMsg is important because Naukri Save is often
        // a DIV rather than a BUTTON.
        // ----------------------------------------------------

        const actions =
          chatbotRoot

            ? [

                ...chatbotRoot
                  .querySelectorAll(
                    `
                    button,
                    [role="button"],
                    input[type="submit"],
                    input[type="button"],
                    .sendMsg
                    `
                  )

              ]
              .filter(
                visible
              )
              .map(
                element => ({

                  text:
                    textOf(
                      element
                    ),

                  tag:
                    element.tagName,

                  class:
                    typeof element.className ===
                    "string"
                      ? element.className
                      : "",

                  disabled:
                    element.disabled ===
                      true ||
                    element.getAttribute(
                      "aria-disabled"
                    ) ===
                      "true"

                })
              )
              .filter(
                item =>
                  item.text
              )

            : [];


        const saveAction =
          actions.find(
            item =>
              /^save$/i.test(
                item.text
              )
          ) ||
          null;


        const nextAction =
          actions.find(
            item =>
              /^(next|continue)$/i.test(
                item.text
              )
          ) ||
          null;


        // ----------------------------------------------------
        // GLOBAL SPECIAL STATES
        // ----------------------------------------------------

        const bodyText =
          clean(
            document.body
              ?.innerText
          );


        const lowerBody =
          bodyText
            .toLowerCase();


        const captchaDetected =

          lowerBody.includes(
            "captcha"
          )

          ||

          !!document.querySelector(
            `
            iframe[src*="captcha"],
            iframe[src*="recaptcha"]
            `
          );


        const loginDetected =

          /login|signin|sign-in/i.test(
            location.pathname
          )

          ||

          (
            lowerBody.includes(
              "login"
            ) &&
            lowerBody.includes(
              "password"
            )
          );


        // ----------------------------------------------------
        // QUESTIONNAIRE FALLBACK SIGNAL
        // ----------------------------------------------------

        const questionnaireText =
          rootLower.includes(
            "recruiter's questions"
          ) ||
          rootLower.includes(
            "recruiter questions"
          ) ||
          rootLower.includes(
            "answer all"
          );


        const questionnaireDetected =
          !!chatbotRoot &&
          (
            questionnaireText ||
            fieldCount > 0 ||
            !!saveAction ||
            !!nextAction
          );


        return {

          url:
            location.href,

          chatbotFound:
            !!chatbotRoot,

          chatbotText:
            rootText
              .slice(
                0,
                1000
              ),

          captchaDetected,

          loginDetected,

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
            saveAction
              ?.disabled ??
            null,

          nextVisible:
            !!nextAction,

          actions

        };

      }
    );


  // ==========================================================
  // 5. ROUTING
  // ==========================================================

  let state =
    "UNKNOWN_POST_APPLY_STATE";


  let reason =
    "No known post-Apply state matched";


  let nextNode =
    "D10_EXCEPTION_INSPECTOR";


  let source =
    "UNKNOWN";


  // ----------------------------------------------------------
  // Safety states first
  // ----------------------------------------------------------

  if (
    dom.captchaDetected
  ) {

    state =
      "CAPTCHA_REQUIRED";

    reason =
      "CAPTCHA/challenge detected.";

    nextNode =
      "D10_EXCEPTION_INSPECTOR";

    source =
      "DOM";

  }


  else if (
    dom.loginDetected
  ) {

    state =
      "LOGIN_REQUIRED";

    reason =
      "Authentication required.";

    nextNode =
      "D10_EXCEPTION_INSPECTOR";

    source =
      "DOM";

  }


  // ----------------------------------------------------------
  // API: recruiter questionnaire
  // ----------------------------------------------------------

  else if (
    questionnaireCount > 0
  ) {

    state =
      "QUESTIONS_PRESENT";

    reason =
      `Apply workflow returned ${questionnaireCount} recruiter question(s).`;

    nextNode =
      "D05_QUESTION_INSPECTOR";

    source =
      "API";

  }


  // ----------------------------------------------------------
  // API: application success
  // ----------------------------------------------------------

  else if (
    apiStatus === 200 &&
    (
      apiMessageLower.includes(
        "successfully applied"
      ) ||
      apiMessageLower.includes(
        "application submitted"
      ) ||
      apiMessageLower.includes(
        "successfully apply"
      )
    )
  ) {

    state =
      "APPLICATION_SUCCESS";

    reason =
      apiMessage ||
      "Apply workflow confirmed application success.";

    nextNode =
      "NEXT_JOB";

    source =
      "API";

  }


  // ----------------------------------------------------------
  // API: already applied
  // ----------------------------------------------------------

  else if (
    apiMessageLower.includes(
      "already applied"
    ) ||
    apiMessageLower.includes(
      "already apply"
    )
  ) {

    state =
      "ALREADY_APPLIED";

    reason =
      apiMessage ||
      "Existing application detected.";

    nextNode =
      "NEXT_JOB";

    source =
      "API";

  }


  // ----------------------------------------------------------
  // API: job unavailable / closed
  // ----------------------------------------------------------

  else if (
    apiMessageLower.includes(
      "expired"
    ) ||
    apiMessageLower.includes(
      "closed"
    ) ||
    apiMessageLower.includes(
      "no longer available"
    )
  ) {

    state =
      "JOB_CLOSED";

    reason =
      apiMessage ||
      "Job is no longer available.";

    nextNode =
      "NEXT_JOB";

    source =
      "API";

  }


  // ----------------------------------------------------------
  // DOM fallback: questionnaire drawer
  //
  // Only use this if API did not provide a decisive state.
  // ----------------------------------------------------------

  else if (
    dom.questionnaireDetected
  ) {

    state =
      "QUESTIONS_PRESENT";

    reason =
      "Recruiter questionnaire detected in Naukri chatbot drawer.";

    nextNode =
      "D05_QUESTION_INSPECTOR";

    source =
      "DOM_FALLBACK";

  }


  // ==========================================================
  // 6. RESULT
  // ==========================================================

  const result = {

    node:
      NODE,

    success:
      state !==
      "UNKNOWN_POST_APPLY_STATE",

    timestamp:
      new Date()
        .toISOString(),

    job:
      d03.job,

    state,

    reason,

    source,

    api: {

      workflowReceived:
        !!d03.workflow
          ?.received,

      httpStatus:
        d03.workflow
          ?.httpStatus ??
        null,

      statusCode:
        payload
          ?.statusCode ??
        null,

      jobStatus:
        apiStatus,

      message:
        apiMessage ||
        null,

      questionnaireCount,

      hasChatbotResponse:
        !!payload
          ?.chatbotResponse,

      flowType:
        payload
          ?.flowType ||
        null

    },

    questionnaire: {

      detected:
        state ===
        "QUESTIONS_PRESENT",

      apiQuestionCount:
        questionnaireCount,

      chatbotFound:
        dom.chatbotFound,

      fieldCount:
        dom.fieldCount,

      radioCount:
        dom.radioCount,

      checkboxCount:
        dom.checkboxCount,

      textInputCount:
        dom.textInputCount,

      textareaCount:
        dom.textareaCount,

      selectCount:
        dom.selectCount,

      saveVisible:
        dom.saveVisible,

      saveDisabled:
        dom.saveDisabled,

      nextVisible:
        dom.nextVisible

    },

    diagnostics: {

      currentUrl:
        dom.url,

      chatbotText:
        dom.chatbotText,

      actions:
        dom.actions

    },

    nextNode,

    error:
      state ===
      "UNKNOWN_POST_APPLY_STATE"

        ? "Unable to classify post-Apply state."

        : null

  };


  // ==========================================================
  // 7. OUTPUT
  // ==========================================================

  console.log(
    "\nD04 RESULT:"
  );


  console.table([
    {

      jobId:
        result.job
          ?.jobId,

      state:
        result.state,

      source:
        result.source,

      apiQuestions:
        result
          .questionnaire
          .apiQuestionCount,

      fields:
        result
          .questionnaire
          .fieldCount,

      saveVisible:
        result
          .questionnaire
          .saveVisible,

      nextNode:
        result.nextNode

    }
  ]);


  return result;

}


// ============================================================
// FAILURE HELPER
// ============================================================

function failure(
  state,
  reason,
  job
) {

  const result = {

    node:
      NODE,

    success:
      false,

    timestamp:
      new Date()
        .toISOString(),

    job:
      job ||
      null,

    state,

    reason,

    nextNode:
      "D10_EXCEPTION_INSPECTOR",

    error:
      reason

  };


  console.error(
    `❌ D04 ${state}:`,
    reason
  );


  return result;

}


module.exports = {
  runD04
};
