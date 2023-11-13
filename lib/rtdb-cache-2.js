const path = require("path");
const { getDatabase, ServerValue } = require("firebase-admin/database");

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
      const lastModified = await this.getHasRevalidatedTags(
        key,
        LastModified?.getTime(),
      );

      if (lastModified === -1) {
        return null;
      }

      if (value === null) return null;

      return {
        lastModified,
        value,
      };
    } catch (e) {
      error("Failed to get fetch cache", e);
      return null;
    }
  }

  async getIncrementalCache(key) {
    try {
      const { value, lastModified } = await this.getRtdbValue(key, "cache");
      const cacheData = value ?? {};
      const meta = value.meta;
      // const lastModified = await this.getHasRevalidatedTags(
      //   key,
      //   LastModified?.getTime(),
      // );
      if (lastModified === -1) {
        return null;
      }
      if (cacheData.type === "route") {
        return {
          lastModified,
          value: {
            kind: "ROUTE",
            body: cacheData.body,
            status: meta?.status,
            headers: meta?.headers,
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
            status: meta?.status,
            headers: meta?.headers,
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
        warn("Unknown cache type", cacheData);
        return null;
      }
    } catch (e) {
      error("Failed to get body cache", e);
      return null;
    }
  }

  async getTagsByPath(path) {
    try {
      if (disableDynamoDBCache) return [];
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: CACHE_DYNAMO_TABLE,
          IndexName: "revalidate",
          KeyConditionExpression: "#key = :key",
          ExpressionAttributeNames: {
            "#key": "path",
          },
          ExpressionAttributeValues: {
            ":key": { S: this.buildRef(path) },
          },
        }),
      );
      const tags = result.Items?.map((item) => item.tag.S ?? "") ?? [];
      debug("tags for path", path, tags);
      return tags;
    } catch (e) {
      error("Failed to get tags by path", e);
      return [];
    }
  }

  async getHasRevalidatedTags(key, lastModified) {
    try {
      const snapshot = await this.rtdb
        .ref(this.buildTagRef())
        .orderByChild(`paths/${key}`)
        .equalTo(true)
        .once("value");
      const result = snapshot.val();
      const revalidatedTags = result ? Object.values(result) : [];
      console.debug("revalidatedTags", revalidatedTags);
      return revalidatedTags.length > 0 ? -1 : lastModified ?? Date.now();
    } catch (e) {
      error("Failed to get revalidated tags", e);
      return lastModified ?? Date.now();
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

  async putRtdbValue(key, extension, value) {
    await this.rtdb.ref(this.buildRef(key, extension)).set({
      value,
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
