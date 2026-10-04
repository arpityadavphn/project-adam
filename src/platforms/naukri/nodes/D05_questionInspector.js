// ============================================================
// PROJECT ADAM
// D05 — QUESTION INSPECTOR
// ============================================================
//
// Responsibility:
//
// Inspect the CURRENT recruiter question visible inside the
// Naukri application chatbot drawer.
//
// Input:
//   page
//   previous = D04 or D08 result
//
// Valid upstream state:
//   QUESTIONS_PRESENT
//
// Output:
//   QUESTION_IDENTIFIED
//       -> D06_ANSWER_ACTOR
//
// IMPORTANT:
// - Scope ONLY to chatbot drawer
// - Do NOT inspect the underlying job page
// - Do NOT answer anything
// - Do NOT store DOM element references
//
// ============================================================


const NODE =
  "D05_QUESTION_INSPECTOR";


async function runD05(
  page,
  previous
) {

  console.log(
    "\n============================================================"
  );

  console.log(
    "D05 — QUESTION INSPECTOR"
  );

  console.log(
    "============================================================"
  );


  // ==========================================================
  // 1. VALIDATE INPUT
  // ==========================================================

  if (
    !previous ||
    previous.state !==
      "QUESTIONS_PRESENT"
  ) {

    return failure(
      "INVALID_INPUT_STATE",
      "D05 requires QUESTIONS_PRESENT from D04 or D08.",
      previous?.job || null,
      null
    );

  }


  // ==========================================================
  // 2. WAIT FOR CHATBOT DRAWER
  // ==========================================================

  try {

    await page.waitForFunction(
      () => {

        return !!(
          document.querySelector(
            "._chatBotContainer"
          ) ||
          document.querySelector(
            ".chatbot_Drawer.chatbot_right"
          ) ||
          document.querySelector(
            ".chatbot_Drawer"
          )
        );

      },
      {
        timeout: 10000
      }
    );

  }

  catch {

    return failure(
      "APPLICATION_DRAWER_NOT_FOUND",
      "Naukri application chatbot drawer was not found.",
      previous.job || null,
      "D10_EXCEPTION_INSPECTOR"
    );

  }


  // ==========================================================
  // 3. WAIT BRIEFLY FOR QUESTION CONTROLS
  // ==========================================================

  try {

    await page.waitForFunction(
      () => {

        const root =
          document.querySelector(
            "._chatBotContainer"
          ) ||
          document.querySelector(
            ".chatbot_Drawer.chatbot_right"
          ) ||
          document.querySelector(
            ".chatbot_Drawer"
          );


        if (!root) {
          return false;
        }


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


        const controls = [

          ...root.querySelectorAll(
            `
            input[type="radio"],
            input[type="checkbox"],
            input[type="text"],
            input[type="number"],
            input[type="email"],
            input:not([type]),
            textarea,
            select
            `
          )

        ].filter(
          visible
        );


        return (
          controls.length > 0
        );

      },
      {
        timeout: 8000
      }
    );

  }

  catch {

    // We still inspect once below.
    // This may be a transition state after the final question.

  }


  // ==========================================================
  // 4. INSPECT CURRENT QUESTION
  // ==========================================================

  const inspection =
    await page.evaluate(
      () => {

        // ----------------------------------------------------
        // HELPERS
        // ----------------------------------------------------

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
        // APPLICATION ROOT
        // ----------------------------------------------------

        const root =
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


        if (!root) {

          return {

            success:
              false,

            state:
              "APPLICATION_DRAWER_NOT_FOUND",

            error:
              "Naukri application drawer not found"

          };

        }


        // ----------------------------------------------------
        // CURRENT CONTROLS
        // ----------------------------------------------------

        const radios = [

          ...root.querySelectorAll(
            'input[type="radio"]'
          )

        ].filter(
          visible
        );


        const checkboxes = [

          ...root.querySelectorAll(
            'input[type="checkbox"]'
          )

        ].filter(
          visible
        );


        const selects = [

          ...root.querySelectorAll(
            "select"
          )

        ].filter(
          visible
        );


        const textInputs = [

          ...root.querySelectorAll(
            `
            input[type="text"],
            input[type="number"],
            input[type="email"],
            input:not([type]),
            textarea
            `
          )

        ].filter(
          visible
        );


        let type =
          "UNKNOWN";


        let controls =
          [];


        // ----------------------------------------------------
        // RADIO
        // ----------------------------------------------------

        if (
          radios.length
        ) {

          type =
            "RADIO_SINGLE";


          const groupName =
            radios[0].name;


          controls =
            groupName

              ? radios.filter(
                  radio =>
                    radio.name ===
                    groupName
                )

              : radios;

        }


        // ----------------------------------------------------
        // CHECKBOX
        // ----------------------------------------------------

        else if (
          checkboxes.length
        ) {

          type =
            "CHECKBOX_MULTI";

          controls =
            checkboxes;

        }


        // ----------------------------------------------------
        // SELECT
        // ----------------------------------------------------

        else if (
          selects.length
        ) {

          type =
            "SELECT_SINGLE";

          controls =
            [
              selects[0]
            ];

        }


        // ----------------------------------------------------
        // TEXT / NUMBER
        // ----------------------------------------------------

        else if (
          textInputs.length
        ) {

          const first =
            textInputs[0];


          type =
            first.tagName ===
              "TEXTAREA"

              ? "TEXT"

              : first.type ===
                  "number"

                ? "NUMBER"

                : "TEXT";


          controls =
            [
              first
            ];

        }


        // ----------------------------------------------------
        // NO CONTROLS
        // ----------------------------------------------------

        if (
          !controls.length
        ) {

          return {

            success:
              false,

            state:
              "QUESTION_CONTROLS_NOT_FOUND",

            chatbotText:
              textOf(root),

            error:
              "No visible recruiter-question controls found"

          };

        }


        // ====================================================
        // OPTION LABEL RESOLUTION
        // ====================================================

        function getLabel(
          control
        ) {

          // ----------------------------------------------
          // Explicit <label for="">
          // ----------------------------------------------

          if (
            control.id
          ) {

            try {

              const explicit =
                root.querySelector(
                  `label[for="${CSS.escape(control.id)}"]`
                );


              if (
                explicit &&
                visible(
                  explicit
                )
              ) {

                const text =
                  textOf(
                    explicit
                  );


                if (
                  text
                ) {
                  return text;
                }

              }

            }

            catch {}

          }


          // ----------------------------------------------
          // Wrapped label
          // ----------------------------------------------

          const wrapped =
            control.closest(
              "label"
            );


          if (
            wrapped &&
            visible(
              wrapped
            )
          ) {

            const text =
              textOf(
                wrapped
              );


            if (
              text
            ) {
              return text;
            }

          }


          // ----------------------------------------------
          // Nearby parent text
          // ----------------------------------------------

          let parent =
            control.parentElement;


          for (
            let depth = 0;
            depth < 4 &&
            parent;
            depth++
          ) {

            const text =
              textOf(
                parent
              );


            if (
              text &&
              text.length <= 100
            ) {

              return text;

            }


            parent =
              parent.parentElement;

          }


          return (
            control.value ||
            ""
          );

        }


        // ====================================================
        // OPTIONS
        // ====================================================

        let options =
          [];


        if (
          type ===
            "RADIO_SINGLE" ||
          type ===
            "CHECKBOX_MULTI"
        ) {

          options =
            controls.map(
              (
                control,
                index
              ) => ({

                index,

                text:
                  getLabel(
                    control
                  ),

                value:
                  control.value ||
                  null,

                checked:
                  control.checked ===
                  true

              })
            );

        }


        else if (
          type ===
          "SELECT_SINGLE"
        ) {

          options = [

            ...controls[0].options

          ].map(
            (
              option,
              index
            ) => ({

              index,

              text:
                clean(
                  option.textContent
                ),

              value:
                option.value,

              selected:
                option.selected ===
                true

            })
          );

        }


        // ====================================================
        // CURRENT VALUE / PLACEHOLDER
        // ====================================================

        let currentValue =
          null;


        let placeholder =
          null;


        if (
          type === "TEXT" ||
          type === "NUMBER"
        ) {

          currentValue =
            controls[0].value ||
            "";


          placeholder =
            controls[0]
              .getAttribute(
                "placeholder"
              ) ||
            null;

        }


        // ====================================================
        // QUESTION TEXT
        //
        // Use geometry around the first active control.
        // Scope is chatbot only.
        // ====================================================

        const firstControl =
          controls[0];


        const controlRect =
          firstControl
            .getBoundingClientRect();


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
        .filter(
          visible
        )
        .map(
          element => {

            const rect =
              element
                .getBoundingClientRect();


            return {

              element,

              text:
                textOf(
                  element
                ),

              gap:
                controlRect.top -
                rect.bottom,

              childCount:
                element.children
                  ?.length ??
                0

            };

          }
        )
        .filter(
          candidate => {

            const text =
              candidate.text;


            if (
              !text ||
              text.length < 5 ||
              text.length > 300
            ) {

              return false;

            }


            // Candidate should be reasonably close
            // above / around the active control.

            if (
              candidate.gap <
                -20 ||
              candidate.gap >
                400
            ) {

              return false;

            }


            const lower =
              text
                .toLowerCase();


            // Exclude obvious UI / option labels.

            if (
              lower === "yes" ||
              lower === "no" ||
              lower === "save" ||
              lower === "skip" ||
              lower ===
                "skip this question" ||
              lower ===
                "try again" ||
              lower ===
                "continue" ||
              lower ===
                "next" ||
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

          }
        );


        // ====================================================
        // SCORE QUESTION CANDIDATES
        // ====================================================

        candidates =
          candidates.map(
            candidate => {

              let score =
                0;


              // Strongest signal.
              if (
                candidate.text
                  .includes("?")
              ) {

                score +=
                  1000;

              }


              // Prefer candidates close to the control.
              score +=
                Math.max(
                  0,
                  350 -
                  Math.abs(
                    candidate.gap
                  )
                );


              // Prefer concise text.
              if (
                candidate.text
                  .length <
                150
              ) {

                score +=
                  150;

              }


              // Prefer leaf-ish elements instead of a giant
              // container containing question + options + Save.
              if (
                candidate.childCount ===
                0
              ) {

                score +=
                  100;

              }


              // Penalize containers that clearly include UI.
              if (
                /\b(save|skip this question)\b/i
                  .test(
                    candidate.text
                  )
              ) {

                score -=
                  500;

              }


              return {

                ...candidate,

                score

              };

            }
          );


        candidates.sort(
          (
            a,
            b
          ) =>
            b.score -
            a.score
        );


        const questionText =
          candidates[0]
            ?.text ||
          "";


        // ====================================================
        // SAVE ACTION — DIAGNOSTIC ONLY
        // ====================================================

        const saveElement = [

          ...root.querySelectorAll(
            ".sendMsg"
          )

        ].find(
          element =>
            visible(
              element
            ) &&
            /^save$/i.test(
              textOf(
                element
              )
            )
        ) ||
        null;


        // ====================================================
        // RESULT DATA
        // ====================================================

        return {

          success:
            !!questionText &&
            type !==
              "UNKNOWN",

          state:
            "QUESTION_IDENTIFIED",

          question: {

            text:
              questionText,

            type,

            options,

            controlCount:
              controls.length,

            currentValue,

            placeholder,

            confidence:
              questionText
                .includes("?")

                ? "HIGH"

                : "MEDIUM"

          },

          diagnostics: {

            chatbotText:
              textOf(root)
                .slice(
                  0,
                  1000
                ),

            candidateCount:
              candidates.length,

            topCandidates:
              candidates
                .slice(
                  0,
                  5
                )
                .map(
                  item => ({

                    text:
                      item.text,

                    gap:
                      Math.round(
                        item.gap
                      ),

                    score:
                      Math.round(
                        item.score
                      )

                  })
                ),

            saveVisible:
              !!saveElement

          },

          error:
            questionText
              ? null
              : "Question text not identified"

        };

      }
    );


  // ==========================================================
  // 5. HANDLE INSPECTION FAILURE
  // ==========================================================

  if (
    !inspection.success
  ) {

    const nextNode =

      inspection.state ===
        "QUESTION_CONTROLS_NOT_FOUND"

        ? "D08_APPLICATION_OUTCOME_INSPECTOR"

        : "D10_EXCEPTION_INSPECTOR";


    return failure(
      inspection.state ||
        "QUESTION_INSPECTION_FAILED",

      inspection.error ||
        "Unable to inspect recruiter question.",

      previous.job ||
        null,

      nextNode,

      inspection
    );

  }


  // ==========================================================
  // 6. PRODUCTION RESULT
  // ==========================================================

  const result = {

    node:
      NODE,

    success:
      true,

    timestamp:
      new Date()
        .toISOString(),

    job:
      previous.job ||
      null,

    state:
      "QUESTION_IDENTIFIED",

    question:
      inspection.question,

    diagnostics:
      inspection.diagnostics,

    nextNode:
      "D06_ANSWER_ACTOR",

    error:
      null

  };


  // ==========================================================
  // 7. LOG
  // ==========================================================

  console.log(
    "\nD05 RESULT:"
  );


  console.table([
    {

      question:
        result.question.text,

      type:
        result.question.type,

      controls:
        result.question
          .controlCount,

      options:
        result.question
          .options.length,

      confidence:
        result.question
          .confidence,

      nextNode:
        result.nextNode

    }
  ]);


  if (
    result.question
      .options.length
  ) {

    console.log(
      "\nOPTIONS:"
    );


    console.table(
      result.question
        .options
    );

  }


  return result;

}


// ============================================================
// FAILURE HELPER
// ============================================================

function failure(
  state,
  reason,
  job,
  nextNode =
    "D10_EXCEPTION_INSPECTOR",
  diagnostics =
    null
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

    diagnostics,

    nextNode,

    error:
      reason

  };


  console.error(
    `❌ D05 ${state}:`,
    reason
  );


  return result;

}


module.exports = {
  runD05
};
