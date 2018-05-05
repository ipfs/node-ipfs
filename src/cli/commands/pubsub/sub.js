'use strict'

module.exports = {
  command: 'sub <topic>',

  describe: 'Subscribe to a topic',

  builder: {},

  handler (argv) {
    const print = require('../../utils').print

    const handler = (msg) => {
      print(msg.data.toString())
    }

    argv.ipfs.pubsub.subscribe(argv.topic, handler, (err) => {
      if (err) {
        throw err
      }
    })
  }
}
