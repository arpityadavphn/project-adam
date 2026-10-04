(async () => {

  const NODE = "D03_APPLY_TRIGGER";

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const clean = s =>
    (s || "").replace(/\s+/g, " ").trim();

  const visible = el => {

    if (!el) return false;

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


  // =====================================================
  // 1. VALIDATE D02 INPUT
  // =====================================================

  const d02 =
    window.ADAM_D02;

  const applyEl =
    window.ADAM_D02_APPLY_ELEMENT;


  if (!d02) {

    console.error(
      "❌ D02 result missing. Run D02 first."
    );

    return;

  }


  if (
    d02.state !== "APPLY_AVAILABLE"
  ) {

    const result = {

      node: NODE,

      success: false,

      state:
        "INVALID_INPUT_STATE",

      reason:
        `D02 state is ${d02.state}`,

      nextNode:
        null

    };

    window.ADAM_D03 =
      result;

    console.error(
      "❌ D03 requires APPLY_AVAILABLE"
    );

    console.log(result);

    return result;
  }


  if (
    !applyEl ||
    !document.contains(applyEl) ||
    !visible(applyEl)
  ) {

    const result = {

      node: NODE,

      success: false,

      state:
        "APPLY_ELEMENT_MISSING",

      reason:
        "D02 Apply element is no longer available",

      nextNode:
        "D02_JOB_PAGE_INSPECTOR"

    };

    window.ADAM_D03 =
      result;

    console.error(
      "❌ Apply element missing/stale"
    );

    console.log(result);

    return result;
  }


  // =====================================================
  // 2. BEFORE SNAPSHOT
  // =====================================================

  const before = {

    url:
      location.href,

    title:
      document.title,

    bodyTextLength:
      clean(document.body.innerText).length,

    buttonCount:
      [...document.querySelectorAll("button")]
        .filter(visible)
        .length,

    dialogCount:
      [
        ...document.querySelectorAll(
          '[role="dialog"], dialog'
        )
      ]
        .filter(visible)
        .length,

    applyStillVisible:
      visible(applyEl)

  };


  // =====================================================
  // 3. WATCH window.open
  // =====================================================

  const originalOpen =
    window.open;

  let popupUrl =
    null;


  window.open =
    function(url, ...args) {

      if (url) {

        try {

          popupUrl =
            new URL(
              url,
              location.origin
            ).href;

        } catch {

          popupUrl =
            String(url);

        }

        console.log(
          "🪟 window.open detected:",
          popupUrl
        );
      }


      // Preserve Naukri's normal behaviour
      return originalOpen.call(
        window,
        url,
        ...args
      );
    };


  // =====================================================
  // 4. CLICK APPLY EXACTLY ONCE
  // =====================================================

  console.log(
    "%cPROJECT ADAM — D03",
    "font-size:16px;font-weight:bold"
  );

  console.log(
    "👉 Triggering Apply:",
    clean(applyEl.innerText)
  );


  let clickError =
    null;


  try {

    applyEl.click();

  } catch (err) {

    clickError =
      String(err);

  }


  // =====================================================
  // 5. ALLOW PAGE TO REACT
  // =====================================================

  await sleep(2500);


  // =====================================================
  // 6. RESTORE window.open
  // =====================================================

  window.open =
    originalOpen;


  // =====================================================
  // 7. AFTER SNAPSHOT
  // =====================================================

  const currentApply =
    [...document.querySelectorAll(
      "button, a, [role='button']"
    )]
    .filter(visible)
    .find(el =>
      clean(el.innerText)
        .toLowerCase() === "apply"
    );


  const after = {

    url:
      location.href,

    title:
      document.title,

    bodyTextLength:
      clean(document.body.innerText).length,

    buttonCount:
      [...document.querySelectorAll("button")]
        .filter(visible)
        .length,

    dialogCount:
      [
        ...document.querySelectorAll(
          '[role="dialog"], dialog'
        )
      ]
        .filter(visible)
        .length,

    applyStillVisible:
      !!currentApply

  };


  // =====================================================
  // 8. CHANGE SIGNALS
  // =====================================================

  const signals = {

    urlChanged:
      before.url !== after.url,

    bodyChanged:
      before.bodyTextLength !==
      after.bodyTextLength,

    buttonCountChanged:
      before.buttonCount !==
      after.buttonCount,

    dialogCountChanged:
      before.dialogCount !==
      after.dialogCount,

    applyDisappeared:
      before.applyStillVisible &&
      !after.applyStillVisible,

    popupOpened:
      !!popupUrl

  };


  // =====================================================
  // 9. OUTPUT CONTRACT
  // =====================================================

  const result = {

    node:
      NODE,

    success:
      clickError === null,

    timestamp:
      new Date().toISOString(),

    job:
      d02.job,

    state:
      clickError
        ? "APPLY_TRIGGER_FAILED"
        : "APPLY_TRIGGERED",

    action: {

      type:
        "CLICK",

      elementText:
        clean(applyEl.innerText),

      elementTag:
        applyEl.tagName,

      elementClass:
        typeof applyEl.className === "string"
          ? applyEl.className
          : null

    },

    before,

    after,

    signals,

    popupUrl,

    nextNode:
      clickError
        ? "D10_EXCEPTION_INSPECTOR"
        : "D04_POST_APPLY_ROUTER",

    error:
      clickError

  };


  window.ADAM_D03 =
    result;


  console.log(
    "D03 Result:"
  );


  console.table([
    {
      state:
        result.state,

      urlChanged:
        signals.urlChanged,

      bodyChanged:
        signals.bodyChanged,

      buttonsChanged:
        signals.buttonCountChanged,

      dialogsChanged:
        signals.dialogCountChanged,

      applyDisappeared:
        signals.applyDisappeared,

      popupOpened:
        signals.popupOpened,

      nextNode:
        result.nextNode
    }
  ]);


  console.log(
    "Full result:",
    result
  );


  return result;

})();