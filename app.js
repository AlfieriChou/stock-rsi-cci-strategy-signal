const koaBody = require('koa-body')
const bodyParser = require('koa-bodyparser')
const BaseFramework = require('@galenjs/framework-next')
const compose = require('koa-compose')

const Schedule = require('@galenjs/schedule')
const BullMq = require('@galenjs/bullmq')

const config = require('./config')

class Framework extends BaseFramework {
  async afterInit () {
    this.bullMq = new BullMq({
      config: this.config.bullMq,
      logger: this.app.coreLogger,
      app: this.app
    })
    await this.bullMq.setup()
    this.app.context.sendMsg = async (jobName, queueName, body, options = {}) => {
      const ret = await this.bullMq.send(jobName, queueName, body, options)
      this.app.coreLogger.info('send bull mq message: ', ret)
      return ret
    }
    this.schedule = new Schedule({
      schedulePath: this.config.schedulePath,
      app: this.app
    })
    await this.schedule.init(this.app.context)
    await super.afterInit()
    this.app.use(compose([
      koaBody({}),
      bodyParser()
    ]))
    this.loadMiddleware([
      'timing',
      'requestLog',
      'errorHandler',
      'cors',
      'router'
    ])
  }

  async beforeClose () {
    this.schedule.softExit()
    await this.bullMq.softExit()
  }
}

const bootstrap = async () => {
  const framework = new Framework(config)
  await framework.init()
  // custom run schedule
  framework.app.use(async (ctx, next) => {
    if (ctx.method === 'POST' && ctx.originalUrl === '/runScheduleByName') {
      const { name } = ctx.request.body
      ctx.assert(name, 'name is required')
      await framework.schedule.runScheduleByName(name, ctx)
      ctx.body = { code: 0, message: 'success' }
    }
    if (ctx.method === 'POST' && ctx.originalUrl === '/runSchedule') {
      const { name, args = [] } = ctx.request.body
      ctx.assert(name, 'name is required')
      await framework.schedule.runSchedule({
        name, args
      }, ctx)
      ctx.body = { code: 0, message: 'success' }
    }
    await next()
  })
  await framework.start()
}

bootstrap()
