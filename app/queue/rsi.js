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
      ctx.logger.warn('[queue] rsi stock multi element strategy error: ', msg.id, id, err)
    }
  }

  async doTrade (id, ctx) {
    const stock = await ctx.models.RsiCciStock.findByPk(id)
    if (!stock) {
      ctx.logger.warn('[queue] rsi stock multi element strategy error: stock not found ', id)
      return
    }
    const [{
      close, open, high, low
    }] = await ctx.stock.loadDataFromPrevNDays(stock.code, 1)
    const rsiFirstElementValue = await ctx.stock.loadRsiData({
      code: stock.code,
      limit: stock.rsiFirstElementDays,
      deflate: item => item.close
    })
    const rsiSecondElementValue = await ctx.stock.loadRsiData({
      code: stock.code,
      limit: stock.rsiSecondElementDays,
      deflate: item => item.close
    })
    const rsiDiff = rsiFirstElementValue - rsiSecondElementValue
    await ctx.models.RsiCciStock.update({
      rsiFirstElementValue,
      rsiSecondElementValue,
      rsiDiff
    }, {
      where: { id }
    })
    await ctx.models.RsiCciStock.writeDailyReport(id, {
      close, open, high, low, rsiFirstElementValue, rsiSecondElementValue, rsiDiff
    }, ctx)
  }
}
