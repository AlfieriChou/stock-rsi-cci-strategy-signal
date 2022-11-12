module.exports = () => async (ctx, next) => {
  const startedAt = Date.now()
  if (['POST', 'PUT', 'DELETE'].includes(ctx.method)) {
    ctx.logger.info('请求信息: ', JSON.stringify(ctx.request.body))
  }
  await next()
  ctx.logger.info('请求时长: ', Date.now() - startedAt)
}
