const { startOfToday } = require('date-fns')

module.exports = Model => {
  return class extends Model {
    // eslint-disable-next-line consistent-return
    static async remoteCreate (ctx) {
      const { request: { body } } = ctx
      const instances = await this.findAll({
        where: {
          code: body.code,
          cciFirstElementDays: body.cciFirstElementDays || 14,
          cciSecondElement: body.cciSecondElement || 0.015,
          rsiFirstElementDays: body.rsiFirstElementDays || 12,
          rsiSecondElementDays: body.rsiSecondElementDays || 24
        },
        raw: true
      })
      if (instances && instances.length) {
        ctx.throw(400, `existing stock ${body.code}`)
      }
      try {
        const currentRet = await ctx.stock.getCurrentInfo(body.code)
        ctx.logger.info('stock current info: ', body.code, currentRet)
        ctx.request.body.currentWorth = currentRet.currentWorth
        return super.remoteCreate(ctx)
      } catch (err) {
        ctx.logger.info('create stock error: ', err)
        ctx.throw(400, 'stock create error')
      }
    }

    static async buy (id, data, ctx) {
      const trx = await this.dataSource.transaction()
      try {
        ctx.assert(data.price, 400, 'price is required')
        const operateAt = await ctx.models.Holiday.getNextTradeDate(Date.now(), ctx)
        await ctx.models.RsiCciStockTradeLog.create({
          type: 'BUY',
          ...data,
          rsiCciStockId: id,
          operateAt
        }, { transaction: trx })
        await this.update({
          latestBuyPrice: data.price,
          isHolding: true
        }, {
          where: { id }
        }, { transaction: trx })
        await trx.commit()
        ctx.logger.info('rsiCciStock buy stock: ', id, data)
      } catch (err) {
        await trx.rollback()
        ctx.logger.warn('rsiCciStock buy stock error: ', id, err)
      }
    }

    static async sell (id, data, ctx) {
      const trx = await this.dataSource.transaction()
      try {
        ctx.assert(data.price, 400, 'price is required')
        const operateAt = await ctx.models.Holiday.getNextTradeDate(Date.now(), ctx)
        await ctx.models.RsiCciStockTradeLog.create({
          type: 'SELL',
          ...data,
          rsiCciStockId: id,
          operateAt
        }, { transaction: trx })
        await this.update({
          isHolding: false,
          latestSellPrice: data.price
        }, {
          where: { id }
        }, { transaction: trx })
        await trx.commit()
        ctx.logger.info('rsiCciStock sale stock: ', id, data)
      } catch (err) {
        await trx.rollback()
        ctx.logger.warn('rsiCciStock sale stock error: ', id, err)
      }
    }

    static async backTest (id, {
      data,
      isEnterPosition,
      isExitPosition
    }, ctx) {
      ctx.assert(id, 'stockId is required')
      ctx.logger.info('rsi cci stock backTest: ', id, {
        isEnterPosition, isExitPosition
      })
      if (isEnterPosition) {
        await this.buy(id, data, ctx)
      }
      if (isExitPosition) {
        await this.sell(id, data, ctx)
      }
    }

    static async writeDailyReport (id, data, ctx) {
      if (!(await ctx.models.Holiday.isHoliday())) {
        const date = startOfToday().getTime()
        const keys = Object.keys(data)
        await ctx.models.RsiCciStockLog.bulkCreate([{
          ...data,
          id: `${id}${date}`,
          date,
          rsiCciStockId: id
        }], {
          updateOnDuplicate: keys
        })
      }
    }

    static async history (ctx) {
      const { code } = ctx.request.body
      await ctx.sendMsg('history', 'STOCK', {
        code
      }, {
        delay: 3000
      })
      return { success: true }
    }
  }
}
