exports.schedule = {
  time: '0 20 15,19 * * *'
}

exports.task = async ctx => {
  const startAt = Date.now()
  ctx.logger.info('cci交易策略定时任务.开始')
  const incr = await ctx.redis.incr('main', 'cci', 10)
  if (incr > 1) {
    return
  }
  const instances = await ctx.models.RsiCciStock.findAll({
    limit: 100,
    raw: true
  })
  if (instances.length) {
    await instances.reduce(async (promise, stock, index) => {
      await promise
      await ctx.sendMsg('cci', 'STOCK', {
        id: stock.id
      }, {
        delay: index * 3000
      })
    }, Promise.resolve())
  }
  ctx.logger.info('cci交易策略定时任务.结束', Date.now() - startAt)
}
