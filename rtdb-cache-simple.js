
const path = require("node:path");

const { IncrementalCache } = require('@neshca/cache-handler');
const {
  reviveFromBase64Representation,
  replaceJsonWithBase64,
} = require('@neshca/json-replacer-reviver')
const { initializeApp, getApps } = require("firebase-admin/app");
const { getDatabase, ServerValue } = require("firebase-admin/database");

const invalidChars = /[.\$\#\[\]\/\x00-\x1F\x7F]/g;

let localTagsManifest = {
  version: 1,
  items: {},
}

function encodeTag(tag) {
  return encodeURIComponent(tag);
}

function decodeTag(tag) {
  return decodeURIComponent(tag);
}

function sanitizeKey(key) {
  return encodeURIComponent(key).replace(invalidChars, "_");
}

class RTDBCache {
  constructor(rtdb, buildId) {
    this.rtdb = rtdb;
    this.buildId = buildId
  }

  async get(key) {
    const snapshot = await this.rtdb.ref(this.buildRef(key)).get()
    const val = snapshot.val()
    if (!val) {
      return null
    }
    return JSON.parse(val, reviveFromBase64Representation)
  }

  async set(key, value) {
    try {
      await this.rtdb.ref(this.buildRef(key)).set(JSON.stringify(value, replaceJsonWithBase64))
    } catch (error) {
      console.debug("Failed to set cache", error)
    }
  }

  async getTagsManifest() {
    try {
      const snapshot = await this.rtdb.ref(this.buildTagsRef()).get()
      const remoteTagsManifest = snapshot.val()

      if (remoteTagsManifest) {
        console.debug("retrieved remoteTagsManifest", remoteTagsManifest)

        Object.entries(remoteTagsManifest).reduce(
          (acc, [tag, revalidatedAt]) => {
            acc[decodeTag(tag)] = { revalidatedAt: parseInt(revalidatedAt ?? '0', 10) }
            return acc
          },
          localTagsManifest.items
        )
        console.debug("updated localTagsManifest", localTagsManifest)
      }

      return localTagsManifest
    } catch (error) {
      console.debug("Failed to get tags manifest", error)
      return localTagsManifest
    }
  }

  async revalidateTag(tag, revalidatedAt) {
    try {
      await this.rtdb.ref(this.buildTagsRef(tag)).update({
        [encodeTag(tag)]: revalidatedAt
      })
    } catch (error) {
      console.debug("Failed to revalidate tag", error)
      localTagsManifest.items[tag] = { revalidatedAt }
    }
  }

  buildRef(key) {
    return path.posix.join(
      this.buildId,
      sanitizeKey(key)
    );
  }

  buildTagsRef() {
    return path.posix.join(
      this.buildId,
      "tags"
    )
  }
}

IncrementalCache.onCreation(() => {
  console.debug("IncrementalCache.onCreation");
  if (getApps().length === 0) {
    initializeApp()
  }
  const rtdb = getDatabase();
  const buildId = process.env.NEXT_BUILD_ID ?? "deadbeef";

  return {
    cache: new RTDBCache(rtdb, buildId),
  }
})

module.exports = IncrementalCache;

