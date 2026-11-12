// The renderer evaluates bundles in several VMs, including retired generations.
// Own one Redis handler per worker process while each VM keeps its own L1 cache.
function createRedisCacheOwner() {
  let handler;
  return (createHandler) => {
    if (!handler) handler = createHandler();
    return handler;
  };
}

module.exports = { createRedisCacheOwner };
