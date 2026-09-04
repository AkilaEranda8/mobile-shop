import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../../../middleware/validate.middleware'
import { sendSuccess } from '../../../utils/response'
import {
  createTierSchema,
  updateTierSchema,
  createPriceListSchema,
  updatePriceListSchema,
  createPriceListItemSchema,
  updatePriceListItemSchema,
  createQtyBreakSchema,
  updateQtyBreakSchema,
  createDealerOverrideSchema,
  updateDealerOverrideSchema,
  resolvePriceQuerySchema,
} from './pricing.schema'
import * as pricing from './pricing.service'

export const pricingRouter = Router()

pricingRouter.get('/resolve', validate(resolvePriceQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as {
      dealerId: string
      productId: string
      quantity: number
      sellUnit?: 'PIECE' | 'BOX' | 'CARTON'
    }
    const result = await pricing.resolveWholesaleUnitPrice({
      tenantId: req.tenantId!,
      dealerId: q.dealerId,
      productId: q.productId,
      quantity: Number(q.quantity),
      sellUnit: q.sellUnit,
    })
    sendSuccess(res, result)
  } catch (e) {
    next(e)
  }
})

// Tiers
pricingRouter.get('/tiers', async (req, res, next) => {
  try {
    sendSuccess(res, await pricing.listTiers(req.tenantId!))
  } catch (e) {
    next(e)
  }
})

pricingRouter.post('/tiers', validate(createTierSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await pricing.createTier(req.tenantId!, req.body), 'Tier created', 201)
  } catch (e) {
    next(e)
  }
})

pricingRouter.patch('/tiers/:id', validate(updateTierSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await pricing.updateTier(req.tenantId!, req.params.id, req.body), 'Tier updated')
  } catch (e) {
    next(e)
  }
})

pricingRouter.delete('/tiers/:id', async (req, res, next) => {
  try {
    sendSuccess(res, await pricing.deleteTier(req.tenantId!, req.params.id), 'Tier deleted')
  } catch (e) {
    next(e)
  }
})

// Price lists
pricingRouter.get('/price-lists', async (req, res, next) => {
  try {
    sendSuccess(res, await pricing.listPriceLists(req.tenantId!))
  } catch (e) {
    next(e)
  }
})

pricingRouter.get('/price-lists/:id', async (req, res, next) => {
  try {
    sendSuccess(res, await pricing.getPriceList(req.tenantId!, req.params.id))
  } catch (e) {
    next(e)
  }
})

pricingRouter.post('/price-lists', validate(createPriceListSchema), async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await pricing.createPriceList(req.tenantId!, req.body),
      'Price list created',
      201,
    )
  } catch (e) {
    next(e)
  }
})

pricingRouter.patch(
  '/price-lists/:id',
  validate(updatePriceListSchema),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await pricing.updatePriceList(req.tenantId!, req.params.id, req.body),
        'Price list updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

pricingRouter.delete('/price-lists/:id', async (req, res, next) => {
  try {
    sendSuccess(res, await pricing.deletePriceList(req.tenantId!, req.params.id), 'Price list deleted')
  } catch (e) {
    next(e)
  }
})

// Items
pricingRouter.post(
  '/price-lists/:priceListId/items',
  validate(createPriceListItemSchema),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await pricing.createPriceListItem(req.tenantId!, req.params.priceListId, req.body),
        'Price list item created',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

pricingRouter.patch(
  '/items/:itemId',
  validate(updatePriceListItemSchema),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await pricing.updatePriceListItem(req.tenantId!, req.params.itemId, req.body),
        'Price list item updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

pricingRouter.delete('/items/:itemId', async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await pricing.deletePriceListItem(req.tenantId!, req.params.itemId),
      'Price list item deleted',
    )
  } catch (e) {
    next(e)
  }
})

// Qty breaks
pricingRouter.post(
  '/items/:itemId/qty-breaks',
  validate(createQtyBreakSchema),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await pricing.createQtyBreak(req.tenantId!, req.params.itemId, req.body),
        'Qty break created',
        201,
      )
    } catch (e) {
      next(e)
    }
  },
)

pricingRouter.patch(
  '/qty-breaks/:breakId',
  validate(updateQtyBreakSchema),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await pricing.updateQtyBreak(req.tenantId!, req.params.breakId, req.body),
        'Qty break updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

pricingRouter.delete('/qty-breaks/:breakId', async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await pricing.deleteQtyBreak(req.tenantId!, req.params.breakId),
      'Qty break deleted',
    )
  } catch (e) {
    next(e)
  }
})

// Dealer overrides
pricingRouter.get('/overrides/:dealerId', async (req, res, next) => {
  try {
    sendSuccess(res, await pricing.listDealerOverrides(req.tenantId!, req.params.dealerId))
  } catch (e) {
    next(e)
  }
})

pricingRouter.post('/overrides', validate(createDealerOverrideSchema), async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await pricing.createDealerOverride(req.tenantId!, req.body),
      'Override created',
      201,
    )
  } catch (e) {
    next(e)
  }
})

pricingRouter.patch(
  '/overrides/:id',
  validate(updateDealerOverrideSchema),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await pricing.updateDealerOverride(req.tenantId!, req.params.id, req.body),
        'Override updated',
      )
    } catch (e) {
      next(e)
    }
  },
)

pricingRouter.delete('/overrides/:id', async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await pricing.deleteDealerOverride(req.tenantId!, req.params.id),
      'Override deleted',
    )
  } catch (e) {
    next(e)
  }
})
