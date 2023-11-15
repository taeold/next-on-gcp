const path = require("path");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getDatabase, ServerValue } = require("firebase-admin/database");

class RTDBCache {
  constructor(_ctx) {
    if (getApps().length === 0) {
      initializeApp()
    }
    this.rtdb = getDatabase();
    this.buildId = process.env.NEXT_BUILD_ID ?? "deadbeef";
  }

  async get(key, options) {
    const isFetchCache =
      typeof options === "object" ? options.fetchCache : options;
    return isFetchCache
      ? this.getFetchCache(key)
      : this.getIncrementalCache(key);
  }

  async set(key, data, ctx) {
    console.debug("set", { key, data })
    if (data?.kind === "ROUTE") {
      const { body, status, headers } = data;
      this.putRtdbValue(
        key,
        data.kind,
        JSON.stringify({
          type: "route",
          body: body.toString("utf8"),
          meta: {
            status,
            headers,
          },
        }),
      );
    } else if (data?.kind === "PAGE") {
      const { html, pageData } = data;
      const isAppPath = typeof pageData === "string";
      this.putRtdbValue(
        key,
        data.kind,
        JSON.stringify({
          type: isAppPath ? "app" : "page",
          html,
          rsc: isAppPath ? pageData : undefined,
          json: isAppPath ? undefined : pageData,
          meta: { status: data.status, headers: data.headers },
        }),
      );
    } else if (data?.kind === "FETCH") {
      await this.putRtdbValue(key, data.kind, JSON.stringify(data));
    } else if (data?.kind === "REDIRECT") {
      await this.putRtdbValue(
        key,
        data.kind,
        JSON.stringify({
          type: "redirect",
          props: data.props,
        }),
      );
    } else if (data === null || data === undefined) {
      await this.removeRtdbValue(key);
    }

    const derivedTags =
      data?.kind === "FETCH"
        ? ctx.tags ?? []
        : data?.kind === "PAGE"
          ? data.headers?.["x-next-cache-tags"]?.split(",") ?? []
          : [];
    console.debug("derivedTags", derivedTags);

    const storedTags = await this.getTagsByPath(key, data.kind);
    const tagsToWrite = derivedTags.filter((tag) => !storedTags.includes(tag));
    if (tagsToWrite.length > 0) {
      await this.setTags(key, data.kind, tagsToWrite);
      await this.refreshTags(tagsToWrite)
    }
  }

  async revalidateTag(tag) {
    console.debug("revalidateTag", tag);
    await this.refreshTags([tag])
  }

  async getFetchCache(key) {
    console.debug("get fetch cache", { key });
    try {
      const value = await this.getRtdbValue(key, "FETCH");

      if (value === null) return null;

      const hasTags = await this.hasStaleTags(key, "FETCH");
      const lastModified = hasTags ? -1 : (value?.lastModified ?? Date.now());

      // If some tags are stale we need to force revalidation
      if (lastModified === -1) {
        return null;
      }

      return {
        lastModified,
        value: value.data,
      };
    } catch (e) {
      console.error("Failed to get fetch cache", e);
      return null;
    }
  }

  async getIncrementalCache(key) {
    try {
      const value = await this.getRtdbValue(key, "cache");

      if (!value) {
        return null
      }

      const hasTags = await this.hasStaleTags(key);
      const lastModified = hasTags ? -1 : (value?.lastModified ?? Date.now());

      if (lastModified === -1) {
        return null;
      }

      const cacheData = JSON.parse(value.data);

      if (cacheData.type === "route") {
        return {
          lastModified,
          value: {
            kind: "ROUTE",
            body: cacheData.body,
            status: cacheData.meta?.status,
            headers: cacheData.meta?.headers,
          },
        };
      } else if (cacheData.type === "page" || cacheData.type === "app") {
        return {
          lastModified,
          value: {
            kind: "PAGE",
            html: cacheData.html,
            pageData:
              cacheData.type === "page" ? cacheData.json : cacheData.rsc,
            status: cacheData.meta?.status,
            headers: cacheData.meta?.headers,
          },
        };
      } else if (cacheData.type === "redirect") {
        return {
          lastModified,
          value: {
            kind: "REDIRECT",
            props: cacheData.props,
          },
        };
      } else {
        console.warn("Unknown cache type", cacheData);
        return null;
      }
    } catch (e) {
      console.error("Failed to get body cache", e);
      return null;
    }
  }

  async getTagsByPath(path, extension) {
    console.debug("getTagsByPath", path, extension)
    try {
      const snapshot = await this.rtdb
        .ref(this.buildRef(path, extension))
        .child("tags")
        .get()
      console.debug("tags ref snapshot", snapshot.exists())
      console.debug("tags ref snapshot", snapshot.hasChildren())
      console.debug("tags ref snapshot", snapshot.numChildren())
      console.debug("tags ref snapshot", snapshot.hasChild("tags"))
      const val = snapshot.val()
      console.debug("tags ref val", val)
      const tags = Object.keys(val ?? {});
      console.debug("tags for path", path, tags);
      return tags;
    } catch (e) {
      console.error("Failed to get tags by path", e);
      return [];
    }
  }

  async hasStaleTags(key, extension, lastModified) {
    try {
      const snapshot = await this.rtdb
        .ref(`${this.buildRef(key, extension)}/tags`)
        .once("value");
      const tags = Object.keys(snapshot.val() ?? {});

      // Filter out tags whose last modified is greater than the last revalidation
      for (const tag of tags) {
        const { revalidatedAt } = await this.getByTag(tag);
        if (lastModified < revalidatedAt) {
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to get revalidated tags", e);
      return false
    }
  }

  async getByTag(tag) {
    try {
      const snapshot = await this.rtdb
        .ref(this.buildTagRef(tag))
        .get()
      return snapshot.val()
    } catch (e) {
      console.error("Failed to get by tag", e);
      return [];
    }
  }

  async setTags(key, extension, tags) {
    const tagsDict = tags.reduce((acc, tag) => {
      acc[tag] = true;
      return acc;
    }, {});
    const snapshot = await this.rtdb
      .ref(`${this.buildRef(key, extension)}/tags`)
      .update(tagsDict)
  }

  async refreshTags(tags) {
    try {
      const promises = tags.map(async (tag) => {
        await this.rtdb.ref(this.buildTagRef(tag)).update(this.buildTagValue(tag));
      })
      await Promise.all(promises);
    } catch (e) {
      console.error("Failed to refresh tags", e);
    }
  }

  buildTagValue() {
    return {
      revalidatedAt: ServerValue.TIMESTAMP,
    };
  }

  buildRef(key, extension) {
    return path.posix.join(
      this.buildId,
      extension === "FETCH" ? "fetch" : "",
      key
    );
  }

  buildTagRef(tag) {
    return path.posix.join(this.buildId, "tags", tag);
  }

  async getRtdbValue(key, extension) {
    try {
      const snapshot = await this.rtdb
        .ref(this.buildRef(key, extension))
        .once("value");
      const result = snapshot.val();
      return result;
    } catch (e) {
      console.warn("This error can usually be ignored : ", e);
      return {};
    }
  }

  async putRtdbValue(key, extension, data) {
    await this.rtdb.ref(this.buildRef(key, extension)).set({
      data,
      lastModified: ServerValue.TIMESTAMP,
    });
  }

  async removeRtdbValue(key) {
    try {
      await this.rtdb.ref(this.buildRef(key)).remove();
    } catch (e) {
      console.error("Failed to delete cache", e);
    }
  }
}

module.exports = RTDBCache;