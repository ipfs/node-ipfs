/* eslint-env mocha */
'use strict'

const fs = require('fs')
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
const hat = require('hat')
const API = require('../../src/http/index')
const ncp = require('ncp').ncp
const path = require('path')
const clean = require('../utils/clean')

describe('HTTP API', () => {
  const repoExample = path.join(__dirname, '../fixtures/go-ipfs-repo')
  const repoTests = path.join(__dirname, '../repo-tests-run')

  // bootstrap nodes get the set up too slow and gets timed out
  const testsForCustomConfig = ['dht.js', 'name.js', 'ping.js']

  let http = {}

  const startHttpAPI = async (config) => {
    http.api = new API({
      repo: repoTests,
      pass: hat(),
      config,
      EXPERIMENTAL: {
        pubsub: true
      }
    })
    await ncp(repoExample, repoTests)
    await http.api.start()
  }

  describe('custom config', () => {
    const config = {
      Bootstrap: [],
      Discovery: {
        MDNS: {
          Enabled: false
        },
        webRTCStar: {
          Enabled: false
        }
      }
    }

    before(async function () {
      this.timeout(60 * 1000)
      await startHttpAPI(config)
    })

    after(async () => {
      await http.api.stop()
      clean(repoTests)
    })

    describe('## http-api spec tests', () => {
      fs.readdirSync(path.join(`${__dirname}/inject/`))
        .forEach((file) => testsForCustomConfig.includes(file) && require(`./inject/${file}`)(http))
    })
  })

  describe('default config', () => {
    const config = {
      Bootstrap: []
    }

    before(async function () {
      this.timeout(60 * 1000)
      await startHttpAPI(config)
    })

    after(async () => {
      await http.api.stop()
      clean(repoTests)
    })

    describe('## http-api spec tests', () => {
      fs.readdirSync(path.join(`${__dirname}/inject/`))
        .forEach((file) => !testsForCustomConfig.includes(file) && require(`./inject/${file}`)(http))
    })
  })
})
