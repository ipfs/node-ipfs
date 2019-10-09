'use strict'

const pkg = require('./package.json')

module.exports = {
  [pkg.name]: function (browser) {
    browser
      .url(process.env.IPFS_EXAMPLE_TEST_URL)
      .waitForElementVisible('#root h1')

    browser.expect.element('#root h1').text.to.contain('Everything is working!').before(30000)
    browser.expect.element('#root').text.to.contain('Added a file!').before(30000)
    browser.expect.element('#root').text.to.contain('hello world from webpacked IPFS').before(30000)

    browser.end()
  }
}

