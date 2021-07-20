/* eslint-env mocha */
'use strict'

const all = require('it-all')
const { getDescribe, getIt, expect } = require('../utils/mocha')
const { CarReader } = require('@ipld/car')
const uint8ArrayFromString = require('uint8arrays/from-string')
const dagPb = require('@ipld/dag-pb')
const dagCbor = require('@ipld/dag-cbor')

/** @typedef { import("ipfsd-ctl/src/factory") } Factory */
/**
 * @param {Factory} common
 * @param {Object} options
 */
module.exports = (common, options) => {
  const describe = getDescribe(options)
  const it = getIt(options)

  describe('.dag.export', () => {
    let ipfs
    before(async () => {
      ipfs = (await common.spawn()).api
    })

    after(() => common.clean())

    it('should export a car file', async () => {
      const child = dagPb.encode({
        Data: uint8ArrayFromString('block-' + Math.random()),
        Links: []
      })
      const childCid = await ipfs.block.put(child, {
        format: 'dag-pb',
        version: 0
      })
      const parent = dagPb.encode({
        Links: [{
          Hash: childCid,
          Tsize: child.length,
          Name: ''
        }]
      })
      const parentCid = await ipfs.block.put(parent, {
        format: 'dag-pb',
        version: 0
      })
      const grandParent = dagCbor.encode({
        parent: parentCid
      })
      const grandParentCid = await await ipfs.block.put(grandParent, {
        format: 'dag-cbor',
        version: 1
      })

      const expectedCids = [
        grandParentCid,
        parentCid,
        childCid
      ]

      const reader = await CarReader.fromIterable(ipfs.dag.export(grandParentCid))
      const cids = await all(reader.cids())

      expect(cids).to.deep.equal(expectedCids)
    })
  })
}
