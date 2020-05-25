'use strict'

const defer = require('p-defer')
const { NotStartedError, AlreadyInitializedError } = require('../errors')
const Components = require('./')
const { withTimeoutOption } = require('../utils')

/**
 * @typedef {import('../api-manager')} ApiManage
 * @typedef {import('./index').DAG} DAG
 * @typedef {import('ipfs-interface').BlockService} BlockService
 * @typedef {import('./init').GCLock} GCLock
 * @typedef {import('./init').Keychain} Keychain
 * @typedef {import('./init').PreloadService} Preload
 * @typedef {import('./init').Options} InitOptions
 * @typedef {import('ipfs-bitswap')} BitSwap
 * @typedef {import('./pin/pin-manager')} PinManager
 * @typedef {import('ipfs-interface').IPLDService} IPLDService
 * @typedef {import('ipfs-interface').IPNSService} IPNSService
 * @typedef {import('ipfs-interface').LibP2PService} LibP2PService
 * @typedef {import('ipfs-interface').PeerInfo} PeerInfo
 * @typedef {import('ipfs-repo')} Repo
 */

/**
 * @callback Stop
 * @returns {Promise<void>}
 *
 * @typedef {Object} StopConfig
 * @property {ApiManage} apiManager
 * @property {Object} options
 * @property {BitSwap} bitswap
 * @property {BlockService} blockService
 * @property {GCLock} gcLock
 * @property {InitOptions} initOptions
 * @property {IPLDService} ipld
 * @property {IPNSService} ipns
 * @property {Keychain} keychain
 * @property {LibP2PService} libp2p
 * @property {PeerInfo} peerInfo
 * @property {Preload} preload
 * @property {PinManager} pinManager
 * @property {Repo} repo
 */

/**
 * @param {StopConfig} config
 * @returns {Stop}
 */
module.exports = ({
  apiManager,
  options: constructorOptions,
  bitswap,
  blockService,
  gcLock,
  initOptions,
  ipld,
  ipns,
  keychain,
  libp2p,
  mfsPreload,
  peerInfo,
  pinManager,
  preload,
  print,
  repo
}) => withTimeoutOption(async function stop () {
  const stopPromise = defer()
  const { cancel } = apiManager.update({ stop: () => stopPromise.promise })

  try {
    blockService.unsetExchange()
    bitswap.stop()
    preload.stop()

    await Promise.all([
      ipns.republisher.stop(),
      mfsPreload.stop(),
      libp2p.stop(),
      repo.close()
    ])

    // Clear our addresses so we can start clean
    peerInfo.multiaddrs.clear()

    const api = createApi({
      apiManager,
      constructorOptions,
      blockService,
      gcLock,
      initOptions,
      ipld,
      keychain,
      peerInfo,
      pinManager,
      preload,
      print,
      repo
    })

    apiManager.update(api, () => { throw new NotStartedError() })
  } catch (err) {
    cancel()
    stopPromise.reject(err)
    throw err
  }

  stopPromise.resolve()
})

/**
 * @param {*} config
 * @returns {*}
 */
function createApi ({
  apiManager,
  constructorOptions,
  blockService,
  gcLock,
  initOptions,
  ipld,
  keychain,
  peerInfo,
  pinManager,
  preload,
  print,
  repo
}) {
  const dag = {
    get: Components.dag.get({ ipld, preload }),
    resolve: Components.dag.resolve({ ipld, preload }),
    tree: Components.dag.tree({ ipld, preload }),
    // FIXME: resolve this circular dependency
    get put () {
      const value = Components.dag.put({ ipld, pin, gcLock, preload })
      Object.defineProperty(this, 'put', { value })
      return value
    }
  }
  const object = {
    data: Components.object.data({ ipld, preload }),
    get: Components.object.get({ ipld, preload }),
    links: Components.object.links({ dag }),
    new: Components.object.new({ ipld, preload }),
    patch: {
      addLink: Components.object.patch.addLink({ ipld, gcLock, preload }),
      appendData: Components.object.patch.appendData({ ipld, gcLock, preload }),
      rmLink: Components.object.patch.rmLink({ ipld, gcLock, preload }),
      setData: Components.object.patch.setData({ ipld, gcLock, preload })
    },
    put: Components.object.put({ ipld, gcLock, preload }),
    stat: Components.object.stat({ ipld, preload })
  }

  const pin = {
    add: Components.pin.add({ pinManager, gcLock, dag }),
    ls: Components.pin.ls({ pinManager, dag }),
    rm: Components.pin.rm({ pinManager, gcLock, dag })
  }

  const block = {
    get: Components.block.get({ blockService, preload }),
    put: Components.block.put({ blockService, pin, gcLock, preload }),
    rm: Components.block.rm({ blockService, gcLock, pinManager }),
    stat: Components.block.stat({ blockService, preload })
  }

  const add = Components.add({ block, preload, pin, gcLock, options: constructorOptions })
  const resolve = Components.resolve({ ipld })
  const refs = Components.refs({ ipld, resolve, preload })
  // @ts-ignore
  refs.local = Components.refs.local({ repo })

  const notStarted = async () => { // eslint-disable-line require-await
    throw new NotStartedError()
  }

  const api = {
    add,
    bitswap: {
      stat: notStarted,
      unwant: notStarted,
      wantlist: notStarted
    },
    block,
    bootstrap: {
      add: Components.bootstrap.add({ repo }),
      list: Components.bootstrap.list({ repo }),
      rm: Components.bootstrap.rm({ repo })
    },
    cat: Components.cat({ ipld, preload }),
    config: Components.config({ repo }),
    dag,
    dns: Components.dns(),
    files: Components.files({ ipld, block, blockService, repo, preload, options: constructorOptions }),
    get: Components.get({ ipld, preload }),
    id: Components.id({ peerInfo }),
    init: async () => { // eslint-disable-line require-await
      throw new AlreadyInitializedError()
    },
    isOnline: Components.isOnline({}),
    key: {
      export: Components.key.export({ keychain }),
      gen: Components.key.gen({ keychain }),
      import: Components.key.import({ keychain }),
      info: Components.key.info({ keychain }),
      list: Components.key.list({ keychain }),
      rename: Components.key.rename({ keychain }),
      rm: Components.key.rm({ keychain })
    },
    ls: Components.ls({ ipld, preload }),
    object,
    pin,
    refs,
    repo: {
      gc: Components.repo.gc({ gcLock, pin, pinManager, refs, repo }),
      stat: Components.repo.stat({ repo }),
      version: Components.repo.version({ repo })
    },
    resolve,
    start: Components.start({
      apiManager,
      options: constructorOptions,
      blockService,
      gcLock,
      initOptions,
      ipld,
      keychain,
      peerInfo,
      pinManager,
      preload,
      print,
      repo
    }),
    stats: {
      bitswap: notStarted,
      bw: notStarted,
      repo: Components.repo.stat({ repo })
    },
    stop: () => {},
    swarm: {
      addrs: notStarted,
      connect: notStarted,
      disconnect: notStarted,
      localAddrs: Components.swarm.localAddrs({ peerInfo }),
      peers: notStarted
    },
    version: Components.version({ repo })
  }

  return api
}
