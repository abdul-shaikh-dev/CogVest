// jest-expo replaces fetch with a stub, so the live check (#825) keeps Node's
// own fetch and puts it back after the preset's setup files have run.
const { TestEnvironment } = require("jest-environment-node");

class LiveProviderEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    this.global.__liveNodeFetch = { fetch, Headers, Request, Response };
  }
}

module.exports = LiveProviderEnvironment;
