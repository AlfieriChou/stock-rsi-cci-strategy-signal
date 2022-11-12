require('dotenv').config()
const path = require('path')
const assert = require('assert')

const {
  // mysql
  MYSQL_HOST,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DB,
  MYSQL_PORT,

  // redis
  REDIS_HOST,

  // port
  PORT
} = process.env

assert(MYSQL_HOST, 'require env MYSQL_HOST')
assert(MYSQL_USER, 'require env MYSQL_USER')
assert(MYSQL_PASSWORD, 'require env MYSQL_PASSWORD')
assert(MYSQL_DB, 'require env MYSQL_DB')
assert(REDIS_HOST, 'require env REDIS_HOST')
assert(PORT, 'require env PORT')

module.exports = {
  models: {
    main: {
      dataSource: 'sequelize',
      options: {
        host: MYSQL_HOST,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DB,
        port: MYSQL_PORT ? parseInt(MYSQL_PORT, 10) : 3306
      }
    },
    virtual: {
      dataSource: 'virtual',
      options: {}
    }
  },
  middlewarePath: 'app/middleware',
  servicePath: 'app/service',
  schedulePath: 'app/schedule',
  plugins: ['doc'].reduce(
    (
      ret,
      plugin
    ) => [...ret, {
      path: path.join(process.cwd(), `plugins/${plugin}`),
      name: plugin
    }],
    []
  ),
  redis: {
    default: {
      host: REDIS_HOST,
      port: 6379,
      password: '',
      db: 2
    },
    clients: {
      main: {
        keyPrefix: 'main'
      }
    }
  },
  bullMq: {
    connection: {
      host: REDIS_HOST,
      port: 6379,
      password: '',
      db: 3
    },
    consumerPath: path.join(__dirname, 'app/queue'),
    sub: {
      cci: {
        topic: 'STOCK',
        group: 'STOCK_cci',
        pullInterval: 1000
      },
      dma: {
        topic: 'STOCK',
        group: 'STOCK_dma',
        pullInterval: 1000
      },
      backTest: {
        topic: 'STOCK',
        group: 'STOCK_backTest',
        pullInterval: 1000
      }
    }
  },
  port: parseInt(PORT || '3000', 10),
  logger: {
    logDir: `${process.cwd()}/logs`
  }
}
