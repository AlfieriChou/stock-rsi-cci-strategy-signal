const { startOfDay } = require('date-fns')
const { sleep } = require('@galenjs/factories/sleep')

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
    const { code } = msg.body
    try {
      await this.syncHistoryData(code, ctx)
    } catch (err) {
      ctx.logger.warn('[queue] sync history time line error: ', msg.id, err)
    }
  }

  async syncHistoryData (code, ctx) {
    const list = await ctx.service.stock.loadDataFromPrevNDays(code, 16392, ctx)
    while (list.length) {
      await ctx.models.StockTimeLine.bulkCreate(list.splice(0, 100).map(item => {
        const date = startOfDay(new Date(item.day)).getTime()
        return {
          id: `${code}_${date}`,
          code,
          date,
          ...item
        }
      }), {
        updateOnDuplicate: ['open', 'close', 'high', 'low']
      })
      ctx.logger.info('[queue] write 100 line done ', code, list.length)
      await sleep(100)
    }
    ctx.logger.info('[queue] syncHistoryData done ', code)
  }
}
