import { test, expect } from "./fixtures"

// Failure / boundary coverage for line-item quantity updates, driven against
// the store API directly: the UI's quantity <select> can only ever emit whole
// positive numbers, so the server is the only place these abuses can be tested.
//
// Each case asserts the cart is left unchanged (1x, EUR 10) after a rejected
// update, so a silently-applied bad value cannot pass.

test.describe("rejected quantity updates leave the cart unchanged", () => {
  for (const quantity of [-1, "2"] as const) {
    test(`rejects quantity ${JSON.stringify(quantity)}`, async ({ storeApi, apiCart }) => {
      const res = await storeApi.updateItem(apiCart.cartId, apiCart.lineId, { quantity })
      expect(res.status).toBe(400)

      const after = await storeApi.getCart(apiCart.cartId)
      expect(after.body.cart.items).toHaveLength(1)
      expect(after.body.cart.items[0].quantity).toBe(1)
      expect(after.body.cart.item_subtotal).toBe(10)
    })
  }

  test("rejects an update to a nonexistent line item", async ({ storeApi, apiCart }) => {
    const res = await storeApi.updateItem(apiCart.cartId, "item_does_not_exist", { quantity: 2 })
    expect(res.status).toBeGreaterThanOrEqual(400)

    const after = await storeApi.getCart(apiCart.cartId)
    expect(after.body.cart.items).toHaveLength(1)
    expect(after.body.cart.items[0].quantity).toBe(1)
  })
})
