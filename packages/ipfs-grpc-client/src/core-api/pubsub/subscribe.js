import { serverStreamToIterator } from '../../utils/server-stream-to-iterator.js'
import { withTimeoutOption } from 'ipfs-core-utils/with-timeout-option'
import { subscriptions } from './subscriptions.js'
import defer from 'p-defer'

/**
 * @param {import('@improbable-eng/grpc-web').grpc} grpc
 * @param {*} service
 * @param {import('../../types').Options} opts
 */
export function grpcPubsubSubscribe (grpc, service, opts) {
  /**
   * @type {import('ipfs-core-types/src/pubsub').API<{}>["subscribe"]}
   */
  async function pubsubSubscribe (topic, handler, options = {}) {
    const request = {
      topic
    }

    const deferred = defer()

    Promise.resolve().then(async () => {
      try {
        for await (const result of serverStreamToIterator(grpc, service, request, {
          host: opts.url,
          debug: Boolean(process.env.DEBUG),
          metadata: options,
          agent: opts.agent
        })) {
          if (result.handler) {
            const subs = subscriptions.get(topic) || new Map()
            subs.set(result.handler, handler)
            subscriptions.set(topic, subs)

            deferred.resolve()
          } else {
            /** @type {import('@libp2p/interfaces/pubsub').Message} */
            const msg = {
              from: result.from,
              sequenceNumber: result.sequenceNumber,
              data: result.data,
              topic: result.topic
            }

            if (typeof handler === 'function') {
              handler(msg)
              continue
            }

            if (handler != null && typeof handler.handleEvent === 'function') {
              handler.handleEvent(msg)
            }
          }
        }
      } catch (/** @type {any} */ err) {
        if (options && options.onError) {
          options.onError(err)
        }
      }
    })

    await deferred.promise
  }

  return withTimeoutOption(pubsubSubscribe)
}
