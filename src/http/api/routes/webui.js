'use strict'

const Joi = require('@hapi/joi')
const resources = require('../../gateway/resources')

module.exports = [
  {
    method: '*',
    path: '/ipfs/{path*}',
    options: {
      handler: resources.gateway.handler,
      validate: {
        params: {
          path: Joi.string().required()
        }
      },
      response: {
        ranges: false // disable built-in support, handler does it manually
      },
      ext: {
        onPostHandler: { method: resources.gateway.afterHandler }
      }
    }
  },
  {
    method: '*',
    path: '/webui',
    handler (request, h) {
      const webuiCID = '/ipfs/QmYcP4sp1nraBiCYi6i9kqdaKobrK32yyMpTrM5JDA8a2C'
      return h.redirect(webuiCID)
    }
  }
]
