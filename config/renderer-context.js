const { TransformStream } = require('stream/web');
const crypto = require('crypto');

const rendererAdditionalContext = {
  URL,
  AbortController,
  AbortSignal,
  performance,
  atob,
  btoa,

  // Apollo Client RSC requirements (issue #255):
  // TransformStream — import-time: JSONEncodeStream extends TransformStream in
  // @apollo/client-react-streaming/stream-utils, evaluated at bundle load.
  TransformStream,
  // crypto.randomUUID — call-time: PreloadQuery generates query transport keys.
  crypto: { randomUUID: crypto.randomUUID.bind(crypto) },
  // fetch suite — call-time: HttpLink uses fetch to query the Rails /graphql endpoint.
  fetch,
  Headers,
  Request,
  Response,
};

module.exports = { rendererAdditionalContext };
