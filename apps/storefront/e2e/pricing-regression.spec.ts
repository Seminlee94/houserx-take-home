import { test } from "./fixtures"

// Regression demonstration.
//
// Rather than assert a known current bug, this test exercises CORRECT behavior
// and then injects a realistic regression to prove the pricing assertion
// actually catches it. The simulated regression: the cart re-pricing path
// breaks (e.g. a bad deploy of the update-line-item workflow), so the backend
// starts failing the quantity-update call.
//
// Cart mutations in this storefront run through Next server actions, which the
// browser POSTs to the current page URL (/dk/cart). We mock that response with
// a 500 to mimic the outage. Expected effect: changing the quantity no longer
// reprices, so the subtotal stays at EUR 10 and the assertion for EUR 20 fails.
//
// This scenario is EXPECTED TO FAIL: the injected 500 blocks re-pricing, so the
// EUR 20 assertion cannot pass. `test.fail()` encodes that expectation — the
// suite stays green while genuinely exercising the regression, and Playwright
// flags it if the body ever unexpectedly passes (e.g. the mock stops working).
test("detects a regression where changing quantity no longer reprices the cart", async ({
  newShopper,
}) => {
  test.fail()

  const shopper = await newShopper()
  const { page, productPage, cartPage } = shopper

  // Correct behavior up to here: 1x Black at EUR 10.
  await productPage.addShirt("Black")
  await cartPage.goto()
  await cartPage.expectVariant("M / Black")
  await cartPage.expectSubtotal(10)

  // Inject the regression: fail the quantity-update server action (POST), while
  // leaving page navigation (GET) untouched so the cart still renders.
  await page.route("**/dk/cart**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 500, contentType: "text/plain", body: "simulated re-pricing outage" })
    } else {
      await route.fallback()
    }
  })

  // A healthy backend would move this to EUR 20. With the regression in place
  // the subtotal stays at EUR 10, so this assertion fails — exactly the signal
  // we want the suite to produce when re-pricing breaks.
  await cartPage.selectQuantity(2)
  await cartPage.expectSubtotal(20)
})
