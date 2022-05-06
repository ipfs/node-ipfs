import { GossipSub } from '@achingbrain/libp2p-gossipsub'

/** @typedef {import('@libp2p/interfaces/pubsub').PubSub} PubSub */

/** @type {() => Record<string, PubSub>}>} */
export const routers = () => ({
  gossipsub: new GossipSub({
    allowPublishToZeroPeers: true,
    emitSelf: true
  })
})
