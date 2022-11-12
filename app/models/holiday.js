const { startOfDay } = require('date-fns')

const ONE_DAY = 24 * 60 * 60 * 1000

module.exports = Model => {
  return class extends Model {
    static async getNextTradeDate (timestamp, ctx) {
      const date = new Date(timestamp)
      let nextTradeDate = startOfDay(timestamp + ONE_DAY)
      if (date.getDay() === 5) {
        nextTradeDate = startOfDay(timestamp + 3 * ONE_DAY)
      }
      if (date.getDay() === 6) {
        nextTradeDate = startOfDay(timestamp + 2 * ONE_DAY)
      }
      const holiday = await ctx.models.Holiday.findOne({
        where: { date: nextTradeDate },
        raw: true
      })
      if (holiday) {
        return this.getNextTradeDate(timestamp + ONE_DAY, ctx)
      }
      return nextTradeDate.getTime()
    }

    static async getPrevTradeDate (timestamp, ctx) {
      const date = new Date(timestamp)
      let prevTradeDate = startOfDay(timestamp - ONE_DAY)
      if (date.getDay() === 0) {
        prevTradeDate = startOfDay(timestamp - 3 * ONE_DAY)
      }
      if (date.getDay() === 6) {
        prevTradeDate = startOfDay(timestamp - 2 * ONE_DAY)
      }
      const holiday = await ctx.models.Holiday.findOne({
        where: { date: prevTradeDate },
        raw: true
      })
      if (holiday) {
        return this.getPrevTradeDate(timestamp - ONE_DAY, ctx)
      }
      return prevTradeDate.getTime()
    }

    static async isHoliday (date) {
      const timestamp = date || Date.now()
      if ([6, 0].includes(new Date(timestamp).getDay())) {
        return true
      }
      const holiday = await this.findOne({
        where: { date: startOfDay(timestamp) },
        raw: true
      })
      return !!holiday
    }
  }
}
