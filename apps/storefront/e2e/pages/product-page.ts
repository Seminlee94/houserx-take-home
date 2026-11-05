import { type Locator, type Page } from "@playwright/test"

export type ShirtColor = "Black" | "White"

// The product detail page. Options are plain buttons; adding to the cart is a
// Next server action POSTed to the page URL.
export class ProductPage {
  readonly page: Page
  readonly addButton: Locator

  constructor(page: Page) {
    this.page = page
    this.addButton = page.getByTestId("add-product-button")
  }

  async goto(handle = "t-shirt") {
    await this.page.goto(`/dk/products/${handle}`)
  }

  async chooseOption(value: string) {
    await this.page.getByRole("button", { name: value, exact: true }).click()
  }

  // Waits for the server action, otherwise navigating to the cart can render it
  // before the item is persisted and show an empty cart.
  async addToCart() {
    const added = this.page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/products/") && r.ok()
    )
    await this.addButton.click()
    await added
  }

  async addShirt(color: ShirtColor, size = "M") {
    await this.goto()
    await this.chooseOption(size)
    await this.chooseOption(color)
    await this.addToCart()
  }
}
