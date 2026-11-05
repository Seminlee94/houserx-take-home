import { expect, type Locator, type Page } from "@playwright/test"

// The cart page. Totals are rendered server-side, and changing a quantity is a
// Next server action POSTed to /dk/cart.
export class CartPage {
  readonly page: Page
  readonly variant: Locator
  readonly quantity: Locator
  readonly subtotal: Locator

  constructor(page: Page) {
    this.page = page
    this.variant = page.getByTestId("product-variant")
    this.quantity = page.getByTestId("product-select-button")
    this.subtotal = page.getByTestId("cart-subtotal")
  }

  async goto() {
    await this.page.goto("/dk/cart")
  }

  async expectVariant(label: string) {
    await expect(this.variant).toContainText(label)
  }

  async expectSubtotal(amount: number) {
    await expect(this.subtotal).toHaveAttribute("data-value", String(amount))
  }

  // Only picks the value. Use when the server action is expected to fail.
  async selectQuantity(quantity: number) {
    await this.quantity.selectOption(String(quantity))
  }

  async changeQuantity(quantity: number) {
    const updated = this.page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/dk/cart") && r.ok()
    )
    await this.selectQuantity(quantity)
    await updated
  }
}
