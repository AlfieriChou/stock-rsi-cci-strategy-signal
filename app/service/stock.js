const got = require('got')

const url = 'https://qt.gtimg.cn/q='
const sinaUrl = 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData'

module.exports = class Stock {
  getMarketCode (code) {
    if (code.startsWith('6') || code.startsWith('5')) {
      return `sh${code}`
    }
    return `sz${code}`
  }

  // eslint-disable-next-line consistent-return
  async getCurrentInfo (code, ctx) {
    const marketCode = this.getMarketCode(code)
    try {
      const data = await got(`${url}${marketCode}`, {
        resolveBodyOnly: true
      })
      const [, name, , currentWorth] = data.split('="')[1].split('~')
      return {
        code, name, currentWorth: parseFloat(currentWorth)
      }
    } catch (err) {
      ctx.logger.info('get stock current info error: ', code, err)
      ctx.throw(400, err)
    }
  }

  // eslint-disable-next-line consistent-return
  async loadHistoryData ({ code, dataLen, scale }, ctx) {
    try {
      const ret = await got(sinaUrl, {
        resolveBodyOnly: true,
        responseType: 'json',
        searchParams: {
          scale: scale || 60,
          ma: 60,
          symbol: this.getMarketCode(code),
          datalen: dataLen
        }
      })
      return ret
    } catch (err) {
      ctx.logger.info('获取stock信息异常', code, err)
      ctx.throw(400, err)
    }
  }

  async loadDataFromPrevNDays (code, n, ctx) {
    const ret = await this.loadHistoryData({
      code, dataLen: n, scale: 240
    }, ctx)
    return ret
      .map(item => {
        return {
          day: item.day,
          close: parseFloat(item.close),
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low)
        }
      })
  }

  ma ({
    list, deflate, limit
  }) {
    const total = list.reduce((sum, item) => sum + deflate(item), 0)
    return total / limit
  }

  async loadMaData ({
    code, limit, deflate
  }, ctx) {
    ctx.assert(deflate, 'deflate is required')
    ctx.assert(code, 'code is required')
    ctx.assert(limit, 'limit is required')
    const list = await ctx.service.stock.loadDataFromPrevNDays(code, limit, ctx)
    ctx.logger.info('loadMaData: ', code, limit, list)
    return this.ma({ list, deflate, limit })
  }

  async loadMdData ({
    code, limit, deflate
  }, ctx) {
    ctx.assert(deflate, 'deflate is required')
    ctx.assert(code, 'code is required')
    ctx.assert(limit, 'limit is required')
    const list = await ctx.service.stock.loadDataFromPrevNDays(code, 2 * limit, ctx)
    ctx.logger.info('loadMdData: ', code, limit, list)
    const maList = list.slice(limit + 1, 2 * limit + 1)
      .map((item, index) => {
        const ma = this.ma({
          list: list.slice(index, limit + index),
          deflate: item => item.close,
          limit
        })
        return {
          ...item,
          ma
        }
      })
    return parseFloat(this.ma({ list: maList, deflate, limit }).toFixed(2))
  }

  async loadCciData ({
    code, limit, coefficient = 0.015
  }, ctx) {
    ctx.assert(code, 'code is required')
    ctx.assert(limit, 'limit is required')
    const list = await ctx.service.stock.loadDataFromPrevNDays(code, limit, ctx)
    ctx.logger.info('[loadCciData] list: ', code, limit, list)
    const typList = list.map(item => {
      return {
        ...item,
        typ: (item.close + item.high + item.low) / 3
      }
    })
    const typMa = this.ma({
      list: typList, deflate: item => item.typ, limit
    })
    const avedenTyp = Math.sqrt(
      typList.reduce((ret, item) => {
        return ret + Math.pow(typMa - item.typ, 2)
      }, 0) / limit,
      2
    )
    const { typ } = typList.pop()
    return parseFloat(((typ - typMa) / (coefficient * avedenTyp)).toFixed(2))
  }

  async loadRsiData ({
    code, limit, deflate
  }, ctx) {
    ctx.assert(deflate, 'deflate is required')
    ctx.assert(code, 'code is required')
    ctx.assert(limit, 'limit is required')
    const list = await ctx.service.stock.loadDataFromPrevNDays(code, limit + 1, ctx)
    ctx.logger.info('[loadRsiData] list: ', code, limit, list)
    const rsiList = list
      .map((item, index) => {
        if (index === 0) {
          return item
        }
        return {
          ...item,
          closeDiff: item.close - list[index - 1].close
        }
      })
      .slice(1)
    const upList = rsiList.filter(item => item.closeDiff >= 0)
    const downList = rsiList.filter(item => item.closeDiff < 0)
    const up = upList.reduce((acc, i) => acc + i.closeDiff, 0)
    const down = downList.reduce((acc, i) => acc + i.closeDiff, 0)
    ctx.logger.info('[loadRsiData] data: ', code, up, down)
    const rsi = parseFloat((100 * up / (up + Math.abs(down))).toFixed(2))
    return rsi
  }
}
