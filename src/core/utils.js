'use strict'

const multihashes = require('multihashes')
const promisify = require('promisify-es6')
const map = require('async/map')
const isIpfs = require('is-ipfs')

exports.OFFLINE_ERROR = 'This command must be run in online mode. Try running \'ipfs daemon\' first.'

/**
 * Break an ipfs-path down into it's hash and an array of links.
 *
 * examples:
 *  b58Hash -> { hash: 'b58Hash', links: [] }
 *  b58Hash/mercury/venus -> { hash: 'b58Hash', links: ['mercury', 'venus']}
 *  /ipfs/b58Hash/links/by/name -> { hash: 'b58Hash', links: ['links', 'by', 'name'] }
 *
 * @param  {String} ipfsPath An ipfs-path
 * @return {Object}            { hash: base58 string, links: [string], ?err: Error }
 * @throws on an invalid @param ipfsPath
 */
function parseIpfsPath (ipfsPath) {
  const invalidPathErr = new Error('invalid ipfs ref path')
  ipfsPath = ipfsPath.replace(/^\/ipfs\//, '')
  const matched = ipfsPath.match(/([^/]+(?:\/[^/]+)*)\/?$/)
  if (!matched) {
    throw invalidPathErr
  }

  const [hash, ...links] = matched[1].split('/')

  // check that a CID can be constructed with the hash
  if (isIpfs.cid(hash)) {
    return { hash, links }
  } else {
    throw invalidPathErr
  }
}

/**
 * Resolve various styles of an ipfs-path to the hash of the target node.
 * Follows links in the path.
 *
 * Accepts formats:
 *  - <base58 string>
 *  - <base58 string>/link/to/venus
 *  - /ipfs/<base58 string>/link/to/pluto
 *  - multihash Buffer
 *  - Arrays of the above
 *
 * @param  {IPFS}               objectAPI The IPFS object api
 * @param  {Described above}    ipfsPaths A single or collection of ipfs-paths
 * @param  {Function<err, res>} callback res is Array<Buffer(hash)>
 *                              if no callback is passed, returns a Promise
 * @return {Promise|void}
 */
const resolvePath = promisify(function (objectAPI, ipfsPaths, callback) {
  if (!Array.isArray(ipfsPaths)) {
    ipfsPaths = [ipfsPaths]
  }

  map(ipfsPaths, (path, cb) => {
    if (typeof path !== 'string') {
      try {
        multihashes.validate(path)
      } catch (err) {
        return cb(err)
      }
      return cb(null, path)
    }

    let parsedPath
    try {
      parsedPath = exports.parseIpfsPath(path)
    } catch (err) {
      return cb(err)
    }

    const rootHash = multihashes.fromB58String(parsedPath.hash)
    const rootLinks = parsedPath.links
    if (!rootLinks.length) {
      return cb(null, rootHash)
    }

    objectAPI.get(rootHash, follow.bind(null, rootLinks))

    // recursively follow named links to the target node
    function follow (links, err, obj) {
      if (err) {
        return cb(err)
      }
      if (!links.length) {
        // done tracing, obj is the target node
        return cb(null, obj.multihash)
      }

      const linkName = links[0]
      const nextObj = obj.links.find(link => link.name === linkName)
      if (!nextObj) {
        return cb(new Error(
          `no link named "${linkName}" under ${obj.toJSON().multihash}`
        ))
      }

      objectAPI.get(nextObj.multihash, follow.bind(null, links.slice(1)))
    }
  }, callback)
})

/**
 * Parses chunker string into options used by DAGBuilder in ipfs-unixfs-engine
 *
 *
 * @param  {String}   chunker Chunker algorithm supported formats:
 *                    "default" ("")
 *                    "size-{size}",
 *                    "rabin"
 *                    "rabin-{avg}"
 *                    "rabin-{min}-{avg}-{max}"
 *
 * @return {Object}   Chunker options for DAGBuilder
 */
function parseChunkerString(chunker) {
  if (!chunker || chunker === '' || chunker === 'default') {
    return {
      chunker: 'fixed',
    }
  } else if (chunker.startsWith('size-')) {
    const sizeStr = chunker.split("-")[1]
    const size = parseInt(sizeStr)
    if (isNaN(size)) {
      throw new Error("Parameter avg must be an integer")
    }
    return {
      chunker: 'fixed',
      chunkerOptions: {
        maxChunkSize: size
      }
    }
  } else if (chunker.startsWith('rabin')) {
    return {
      chunker: 'rabin',
      chunkerOptions: parseRabinString(chunker)
    }
  } else {
    throw new Error(`unrecognized chunker option: ${chunker}`)
  }
}

/**
 * Parses rabin chunker string
 *
 * @param  {String}   chunker Chunker algorithm supported formats:
 *                            "rabin"
 *                            "rabin-{avg}"
 *                            "rabin-{min}-{avg}-{max}"
 *
 * @return {Object}   rabin chunker options
 */
function parseRabinString(chunker) {
  const options = {}
  const parts = chunker.split("-")
  switch (parts.length) {
    case 1:
      options.avgChunkSize = 262144
      break
    case 2:
      options.avgChunkSize = parseInt(parts[1])
      if (isNaN(options.avgBlockSize)) {
        throw new Error("Parameter avg must be an integer")
      }
      break
    case 4:
      options.minChunkSize = parseSub(parts[1].split(":"), "min")
      options.avgChunkSize = parseSub(parts[2].split(":"), "avg")
      options.maxChunkSize = parseSub(parts[3].split(":"), "max")
      break
    default:
      throw new Error("incorrect format (expected 'rabin' 'rabin-[avg]' or 'rabin-[min]-[avg]-[max]'")
  }

  return options
}

function parseSub(sub, name) {
  if (sub.length > 1 && sub[0] !== name) {
    throw new Error("Parameter order must be min:avg:max")
  }
  let size = parseInt(sub[sub.length-1])
  if (isNaN(size)) {
    throw new Error(`Parameter ${name} must be an integer`)
  }

  return size
}

exports.parseIpfsPath = parseIpfsPath
exports.resolvePath = resolvePath
exports.parseChunkerString = parseChunkerString
