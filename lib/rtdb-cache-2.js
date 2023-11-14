const path = require("path");
const { getDatabase, ServerValue  } = require("firebase-admin/database");

const CACHE_EXTENSION_REGEX = /\.(cache|fetch)$/;

function hasCacheExtension(key) {
  return CACHE_EXTENSION_REGEX.test(key);
}

class RTDBCache {
  constructor(_ctx) {
    this.rtdb = getDatabase();
    this.buildId = process.env.NEXT_BUILD_ID;
  }

  async get(key, options) {
    const isFetchCache =
      typeof options === "object" ? options.fetchCache : options;
    return isFetchCache
      ? this.getFetchCache(key)
      : this.getIncrementalCache(key);
  }

  async set(key, data) {
    if (data?.kind === "ROUTE") {
      const { body, status, headers } = data;
      this.putRtdbValue(
        key,
        "cache",
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
        "cache",
        JSON.stringify({
          type: isAppPath ? "app" : "page",
          html,
          rsc: isAppPath ? pageData : undefined,
          json: isAppPath ? undefined : pageData,
          meta: { status: data.status, headers: data.headers },
        }),
      );
    } else if (data?.kind === "FETCH") {
      await this.putRtdbValue(key, "fetch", JSON.stringify(data));
    } else if (data?.kind === "REDIRECT") {
      await this.putRtdbValue(
        key,
        "cache",
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
        ? data.data.tags ?? []
        : data?.kind === "PAGE"
        ? data.headers?.["x-next-cache-tags"]?.split(",") ?? []
        : [];
    console.debug("derivedTags", derivedTags);

    const storedTags = await this.getTagsByPath(key);
    const tagsToWrite = derivedTags.filter((tag) => !storedTags.includes(tag));
    if (tagsToWrite.length > 0) {
      await this.batchWriteDynamoItem(
        tagsToWrite.map((tag) => ({
          path: key,
          tag: tag,
        })),
      );
    }
  }

  async revalidateTag(tag) {
    console.debug("revalidateTag", tag);

    const paths = await this.getByTag(tag);
    debug("Items", paths);

    await this.batchWriteDynamoItem(
      paths?.map((path) => ({
        path: path,
        tag: tag,
      })) ?? [],
    );
  }

  async getFetchCache(key) {
    console.debug("get fetch cache", { key });
    try {
      const value = await this.getRtdbValue(key, "fetch");

      if (value === null) return null;

      const hasTags = await this.hasTags(key);
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
      const value  = await this.getRtdbValue(key, "cache");

      if (!value) {
        return null
      }

      const hasTags = await this.hasTags(key);
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

  async getTagsByPath(path) {
    try {
      const snapshot = await this.rtdb
        .ref(`${this.buildRef(key)}/tags`)
        .once("value");

      const tags = Object.values(snapshot.val() ?? {});
      console.debug("tags for path", path, tags);
      return tags;
    } catch (e) {
      console.error("Failed to get tags by path", e);
      return [];
    }
  }

  async hasStaleTags(key, lastModified) {
    try {
      const snapshot = await this.rtdb
        .ref(`${this.buildRef(key)}/tags`)
        .once("value");
      const tags = Object.values(snapshot.val() ?? {});
      // Filter out tags whose last modified is greater than the last revalidation
      for (const tag of tags) {
        const { revalidatedAt } = await this.getTag(tag);
        if (lastModified < revalidatedAt) {
          return true;
        }
      }
      return false;
    } catch (e) {
      error("Failed to get revalidated tags", e);
      return false
    }
  }

  async getByTag(tag) {
    try {
      if (disableDynamoDBCache) return [];
      const { Items } = await this.dynamoClient.send(
        new QueryCommand({
          TableName: CACHE_DYNAMO_TABLE,
          KeyConditionExpression: "#tag = :tag",
          ExpressionAttributeNames: {
            "#tag": "tag",
          },
          ExpressionAttributeValues: {
            ":tag": { S: this.buildDynamoKey(tag) },
          },
        }),
      );
      return (
        Items?.map(
          ({ path: { S: key } }) => key?.replace(`${this.buildId}/`, "") ?? "",
        ) ?? []
      );
    } catch (e) {
      error("Failed to get by tag", e);
      return [];
    }
  }

  buildDynamoKey(key) {
    return path.posix.join(this.buildId, key);
  }

  buildDynamoObject(path, tags) {
    return {
      path: { S: this.buildDynamoKey(path) },
      tag: { S: this.buildDynamoKey(tags) },
      revalidatedAt: { N: `${Date.now()}` },
    };
  }

  buildRef(key, extension) {
    return path.posix.join(
      this.buildId,
      extension === "fetch" ? "fetch" : "",
      extension === "fetch" ? key : `${key}.${extension}`,
    );
  }

  buildTagRef(tag) {
    return path.posix.join(this.buildId, "tags", tag ?? "");
  }

  async getRtdbValue(key, extension) {
    try {
      const snapshot = await this.rtdb
        .ref(this.buildRef(key, extension))
        .once("value");
      const result = snapshot.value();
      return result;
    } catch (e) {
      warn("This error can usually be ignored : ", e);
      return {};
    }
  }

  async putRtdbValue(key, extension, dat) {
    await this.rtdb.ref(this.buildRef(key, extension)).set({
      data,
      lastModified: ServerValue.TIMESTAMP,
    });
  }

  async removeRtdbValue(key) {
    try {
      await this.rtdb.ref(this.buildRef(key)).remove();
    } catch (e) {
      error("Failed to delete cache", e);
    }
  }
}
