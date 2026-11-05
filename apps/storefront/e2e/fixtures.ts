// Test fixtures for the cart pricing e2e suite.
//
// Isolation model:
// - Every shopper gets its own BrowserContext (its own cookie jar), so the
//   httpOnly `_medusa_cart_id` cookie that identifies a cart is never shared.
//   A test can create several shoppers and they stay independent.
// - The `catalog` fixture is read-only, so it is safe to share across a worker.
// - No test ever mutates the catalog, price, or inventory; each test only
//   writes inside its own freshly created cart. That is what makes the suite
//   safe to run fully in parallel.

import {
  test as base,
  expect,
  request,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test"
import { E2E } from "./load-env"
import { CartPage } from "./pages/cart-page"
import { ProductPage } from "./pages/product-page"

const BLACK_SKU = "SHIRT-M-BLACK"
const WHITE_SKU = "SHIRT-M-WHITE"
const EXPECTED_PRICE = 10
const CART_FIELDS =
  "fields=id,currency_code,item_subtotal,*items,*items.variant,+items.unit_price,+items.subtotal"

type ApiResult<T = any> = { status: number; body: T }

type Catalog = {
  regionId: string
  price: number
  variantIdBySku: Record<string, string>
}

type StoreApi = {
  ctx: APIRequestContext
  createCart: (opts?: { countryCode?: string }) => Promise<string>
  addItem: (cartId: string, variantId: string, quantity: unknown) => Promise<ApiResult>
  updateItem: (cartId: string, lineId: string, body: Record<string, unknown>) => Promise<ApiResult>
  getCart: (cartId: string) => Promise<ApiResult>
}

type Shopper = {
  context: BrowserContext
  page: Page
  productPage: ProductPage
  cartPage: CartPage
  getCart: () => Promise<any | null>
}

type Fixtures = {
  catalog: Catalog
  storeApi: StoreApi
  newShopper: () => Promise<Shopper>
  apiCart: { cartId: string; lineId: string }
}

async function result(promise: Promise<import("@playwright/test").APIResponse>): Promise<ApiResult> {
  const response = await promise
  let body: any = null
  try {
    body = await response.json()
  } catch {
    body = await response.text()
  }
  return { status: response.status(), body }
}

export const test = base.extend<Fixtures>({
  catalog: [
    async ({ playwright }, use) => {
      const ctx = await playwright.request.newContext({
        baseURL: E2E.backendUrl,
        extraHTTPHeaders: { "x-publishable-api-key": E2E.publishableKey },
      })

      const regionsRes = await ctx.get("/store/regions")
      const regions = (await regionsRes.json()).regions as Array<{ id: string; name: string }>
      const europe = regions.find((r) => r.name === "Europe")
      if (!europe) {
        throw new Error("Seed is missing the Europe region. Run `pnpm run e2e:reset`.")
      }

      const productsRes = await ctx.get(
        `/store/products?handle=t-shirt&region_id=${europe.id}&fields=*variants,*variants.calculated_price`
      )
      const products = (await productsRes.json()).products as Array<any>
      const variants = products.flatMap((p) => p.variants ?? [])

      const variantIdBySku: Record<string, string> = {}
      for (const sku of [BLACK_SKU, WHITE_SKU]) {
        const variant = variants.find((v) => v.sku === sku)
        if (!variant) {
          throw new Error(`Seed is missing variant ${sku}. Run \`pnpm run e2e:reset\`.`)
        }
        const amount = variant.calculated_price?.calculated_amount
        if (amount !== EXPECTED_PRICE) {
          throw new Error(`Expected ${sku} at EUR ${EXPECTED_PRICE}, seed has ${amount}.`)
        }
        variantIdBySku[sku] = variant.id
      }

      await use({ regionId: europe.id, price: EXPECTED_PRICE, variantIdBySku })
      await ctx.dispose()
    },
    { scope: "worker" },
  ],

  storeApi: async ({ catalog }, use) => {
    const ctx = await request.newContext({
      baseURL: E2E.backendUrl,
      extraHTTPHeaders: { "x-publishable-api-key": E2E.publishableKey },
    })

    const api: StoreApi = {
      ctx,
      async createCart(opts) {
        const res = await ctx.post("/store/carts", {
          data: {
            region_id: catalog.regionId,
            shipping_address: { country_code: opts?.countryCode ?? "dk" },
          },
        })
        const body = await res.json()
        if (!body.cart?.id) {
          throw new Error(`Failed to create cart: ${JSON.stringify(body)}`)
        }
        return body.cart.id
      },
      addItem(cartId, variantId, quantity) {
        return result(
          ctx.post(`/store/carts/${cartId}/line-items`, {
            data: { variant_id: variantId, quantity },
          })
        )
      },
      updateItem(cartId, lineId, body) {
        return result(ctx.post(`/store/carts/${cartId}/line-items/${lineId}`, { data: body }))
      },
      getCart(cartId) {
        return result(ctx.get(`/store/carts/${cartId}?${CART_FIELDS}`))
      },
    }

    await use(api)
    await ctx.dispose()
  },

  newShopper: async ({ browser, storeApi }, use) => {
    const contexts: BrowserContext[] = []

    const make = async (): Promise<Shopper> => {
      const context = await browser.newContext({ baseURL: E2E.baseURL })
      contexts.push(context)
      const page = await context.newPage()

      const getCart = async () => {
        const cookies = await context.cookies()
        const cartId = cookies.find((c) => c.name === "_medusa_cart_id")?.value
        if (!cartId) {
          return null
        }
        const { body } = await storeApi.getCart(cartId)
        return body.cart ?? null
      }

      return {
        context,
        page,
        productPage: new ProductPage(page),
        cartPage: new CartPage(page),
        getCart,
      }
    }

    await use(make)

    // Close every context even if the test threw, so no shopper state leaks.
    for (const context of contexts) {
      await context.close()
    }
  },

  apiCart: async ({ catalog, storeApi }, use) => {
    const cartId = await storeApi.createCart()
    const added = await storeApi.addItem(cartId, catalog.variantIdBySku[BLACK_SKU], 1)
    expect(added.status).toBe(200)
    const lineId = added.body.cart.items[0].id
    await use({ cartId, lineId })
  },
})

export { expect, BLACK_SKU, WHITE_SKU, EXPECTED_PRICE }
