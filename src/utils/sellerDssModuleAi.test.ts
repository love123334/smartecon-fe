import { describe, expect, it } from 'vitest'
import {
  buildInventoryAiInsight,
  buildPricePredictionAiInsight,
  buildSellerDssModuleCards,
  buildWhatIfAiInsight,
} from '@/utils/sellerDssModuleAi'

describe('buildSellerDssModuleCards', () => {
  it('builds four module cards with AI from catalog signals', () => {
    const cards = buildSellerDssModuleCards({
      insights: [
        {
          title: 'Tồn kho thấp',
          description: 'Noise Cancelling Headphones — còn 5 sản phẩm.',
          impact: 'high',
          category: 'inventory',
        },
      ],
      products: [
        {
          name: 'Noise Cancelling Headphones',
          stock: 5,
          soldCount: 120,
          price: 2_500_000,
          rating: 4.6,
        },
        {
          name: 'USB-C Hub',
          stock: 0,
          soldCount: 12,
          price: 350_000,
          rating: 4.1,
        },
      ],
    })

    expect(cards).toHaveLength(4)
    expect(cards.map((c) => c.key)).toEqual(['demand', 'price', 'inventory', 'whatif'])
    expect(cards[0].aiSummary).toMatch(/Noise Cancelling Headphones/)
    expect(cards[2].aiTone).toBe('warn')
    expect(cards[2].aiBadge).toMatch(/nhập|hết/i)
  })
})

describe('module result AI builders', () => {
  it('explains best price scenario', () => {
    const ai = buildPricePredictionAiInsight({
      productName: 'AirPods Pro 2',
      currentPrice: 5_990_000,
      cost: 4_000_000,
      averageElasticity: -1.2,
      totalQuantitySold: 80,
      best: {
        priceChangePercent: -5,
        newPrice: 5_690_500,
        expectedProfit: 50_000_000,
        predictedDemand: 95,
        profitPerProduct: 1_690_500,
      },
    })
    expect(ai.tone).toBe('warn')
    expect(ai.summary).toMatch(/5\.690|5690|5.690/i)
  })

  it('flags inventory need', () => {
    const ai = buildInventoryAiInsight({
      focusProductName: 'USB-C Hub',
      overallStatus: 'need',
      recommendationMessage: 'Nên nhập thêm hàng.',
      currentStock: 3,
      reorderPoint: 20,
      recommendedOrderQuantity: 40,
      averageDailyDemand: 2,
      needRowCount: 2,
    })
    expect(ai.tone).toBe('warn')
    expect(ai.actions[0]).toMatch(/40/)
  })

  it('uses backend what-if insight when rich', () => {
    const ai = buildWhatIfAiInsight({
      productName: 'Laptop X',
      discountPercentage: 10,
      currentProfit: 10_000_000,
      expectedProfit: 12_000_000,
      breakEvenQuantity: 50,
      additionalUnitsRequired: 5,
      predictedDemand: 60,
      businessInsight: 'Giảm 10% vẫn tăng lợi nhuận nhờ cầu tăng đủ lớn để bù biên.',
    })
    expect(ai.tone).toBe('strong')
    expect(ai.summary).toMatch(/Giảm 10%/)
  })
})
