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
      ctx.logger.warn('[queue] cci stock multi element strategy error: ', msg.id, id, err)
    }
  }

  async doTrade (id, ctx) {
    const stock = await ctx.models.RsiCciStock.findByPk(id)
    if (!stock) {
      ctx.logger.warn('[queue] cci stock multi element strategy error: stock not found ', id)
      return
    }
    const { currentWorth } = await ctx.stock.getCurrentInfo(stock.code)
    const [{
      close, open, high, low
    }] = await ctx.stock.loadDataFromPrevNDays(stock.code, 1)
    const cci = await ctx.stock.loadCciData({
      code: stock.code,
      limit: stock.cciFirstElementDays,
      coefficient: stock.cciSecondElement
    })
    ctx.logger.info('[queue] cci: ', id, stock.code, cci)
    await ctx.models.RsiCciStock.update({
      currentWorth,
      cci
    }, {
      where: { id }
    })
    await ctx.models.RsiCciStock.writeDailyReport(id, {
      close, open, high, low, cci
    }, ctx)
  }
}
