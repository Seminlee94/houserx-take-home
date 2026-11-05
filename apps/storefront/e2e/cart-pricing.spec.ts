import { test, expect, BLACK_SKU, WHITE_SKU } from "./fixtures"

test("adds M/Black, changes quantity, and pricing stays correct", async ({
  newShopper,
  catalog,
}) => {
  const shopper = await newShopper()
  const { productPage, cartPage } = shopper

  await productPage.addShirt("Black")
  await cartPage.goto()
  await cartPage.expectVariant("M / Black")

  // Quantity 1 -> EUR 10 subtotal.
  await cartPage.expectSubtotal(10)

  // Quantity 2 -> EUR 20 subtotal.
  await cartPage.changeQuantity(2)
  await cartPage.expectSubtotal(20)

  // Cross-check the persisted cart via the API: identity + price, not just the
  // number rendered in the UI.
  const cart = await shopper.getCart()
  expect(cart.items).toHaveLength(1)
  const item = cart.items[0]
  expect(item.variant.sku).toBe(BLACK_SKU)
  expect(item.variant.id).toBe(catalog.variantIdBySku[BLACK_SKU])
  expect(item.quantity).toBe(2)
  expect(item.unit_price).toBe(catalog.price)
  expect(cart.currency_code).toBe("eur")
  expect(cart.item_subtotal).toBe(20)
})

test("two concurrent shoppers keep separate carts and prices", async ({ newShopper, catalog }) => {
  const [alice, bob] = await Promise.all([newShopper(), newShopper()])
  // explore load testing 

  await alice.productPage.addShirt("Black")
  await alice.cartPage.goto()
  await alice.cartPage.expectVariant("M / Black")
  await alice.cartPage.changeQuantity(2)
  await alice.cartPage.expectSubtotal(20)

  await bob.productPage.addShirt("White")
  await bob.cartPage.goto()
  await bob.cartPage.expectVariant("M / White")
  await bob.cartPage.expectSubtotal(10)

  const aliceCart = await alice.getCart()
  const bobCart = await bob.getCart()

  // Different carts entirely.
  expect(aliceCart.id).not.toBe(bobCart.id)

  // Alice: 2x Black only.
  expect(aliceCart.items.map((i: any) => i.variant.sku)).toEqual([BLACK_SKU])
  expect(aliceCart.items[0].quantity).toBe(2)
  expect(aliceCart.item_subtotal).toBe(20)

  // Bob: 1x White only — no bleed-through from Alice.
  expect(bobCart.items.map((i: any) => i.variant.sku)).toEqual([WHITE_SKU])
  expect(bobCart.items[0].quantity).toBe(1)
  expect(bobCart.item_subtotal).toBe(10)
})
