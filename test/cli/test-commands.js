/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const repoPath = require('./index').repoPath
const ipfsBase = require('../utils/ipfs-exec')
const ipfs = ipfsBase(repoPath)
const describeOnlineAndOffline = require('../utils/on-and-off')

// NOTE: Floodsub CLI tests will not be run until
// https://github.com/ipfs/js-ipfs-api/pull/377
// is merged. But we have the files ready to go
// so the command count is bumped from 56 to 61
const commandCount = 61

describe('commands', () => {
  describeOnlineAndOffline(repoPath, () => {
    it('list the commands', () => {
      return ipfs('commands').then((out) => {
        expect(out.split('\n')).to.have.length(commandCount)
      })
    })
  })

  it('list the commands even if not in the same dir', () => {
    return ipfsBase(repoPath, {
      cwd: '/tmp'
    })('commands').then((out) => {
      expect(out.split('\n').length).to.equal(commandCount)
    })
  })
})
