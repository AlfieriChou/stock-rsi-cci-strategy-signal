module.exports = class Trade {
  async onMsg (msg, ctx) {
    const duplicateCount = await ctx.redis.incr(
      'main',
        `consumerMessageId:${msg.id}`,
        5 * 60
    )
    if (duplicateCount > 1) {
      ctx.logger.info('[queue] duplicate message ', msg.id)
      return
    }
    const { id } = msg.body
    try {
      await this.doTrade(id, ctx)
    } catch (err) {
      ctx.logger.warn('[queue] back test error: ', msg.id, id, err)
    }
  }

  async doTrade (id, ctx) {
    const stock = await ctx.models.RsiCciStock.findByPk(id)
    if (!stock) {
      ctx.logger.warn('[queue] back test error: stock not found ', id)
      return
    }
    const {
      currentWorth, cci, rsiDiff,
      rsiFirstElementValue, rsiSecondElementValue,
      isHolding
    } = stock
    const isEnterPosition = cci > -100 && cci < 100 && rsiDiff >= 0
    await ctx.models.RsiCciStock.backTest(id, {
      data: {
        price: currentWorth,
        operateLog: {
          cci,
          rsiDiff,
          rsiFirstElementValue,
          rsiSecondElementValue
        }
      },
      isEnterPosition: isEnterPosition && !isHolding,
      isExitPosition: !isEnterPosition && isHolding
    }, ctx)
  }
}
