'use strict'

const { isValidMultiaddr } = require('./utils')
const { withTimeoutOption } = require('../../utils')

/**
 * @param {import('..').IPFSRepo} repo
 */
module.exports = ({ repo }) => {
  /**
   * Remove a peer address from the bootstrap list
   *
   * @param {Multiaddr} multiaddr - The address of a network peer
   * @param {AbortOptions} options
   * @returns {Promise<Peers>}
   * @example
   * ```js
   * const res = await ipfs.bootstrap.list()
   * console.log(res.Peers)
   * // Logs:
   * // [address1, address2, ...]
   * ```
   */
  async function rm (multiaddr, options = {}) {
    if (!isValidMultiaddr(multiaddr)) {
      throw new Error(`${multiaddr} is not a valid Multiaddr`)
    }

    const config = await repo.config.getAll(options)
    config.Bootstrap = (config.Bootstrap || []).filter(ma => ma !== multiaddr)

    await repo.config.set(config)

    return { Peers: [multiaddr] }
  }

  return withTimeoutOption(rm)
}

/**
 * @typedef {import('../../utils').AbortOptions} AbortOptions
 * @typedef {import('./utils').Peers} Peers
 * @typedef {import('..').CID} CID
 * @typedef {import('..').Multiaddr} Multiaddr
 */
