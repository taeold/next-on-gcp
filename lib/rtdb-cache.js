import LRUCache from "next/dist/compiled/lru-cache";
import { getDatabase } from "firebase-admin/database";

import path from "../../../shared/lib/isomorphic/path";
import {
  NEXT_CACHE_TAGS_HEADER,
  RSC_PREFETCH_SUFFIX,
  RSC_SUFFIX,
} from "../../../lib/constants";

let tagsManifest;

class FileSystemCache {
  constructor(ctx) {
    this.rtdb = getDatabase();
    this.appDir = !!ctx._appDir;
    this.pagesDir = !!ctx._pagesDir;
    this.buildId = this.revalidatedTags = ctx.revalidatedTags;

    if (this.serverDistDir && this.fs) {
      this.tagsManifestPath = path.join(
        this.serverDistDir,
        "..",
        "cache",
        "fetch-cache",
        "tags-manifest.json",
      );
      this.loadTagsManifest();
    }
  }

  loadTagsManifest() {
    if (!this.rtdb) return;
    try {
      this.rtdb.ref();
      tagsManifest = JSON.parse(
        this.fs.readFileSync(this.tagsManifestPath, "utf8"),
      );
    } catch (err) {
      tagsManifest = { version: 1, items: {} };
    }
  }

  async revalidateTag(tag) {
    this.loadTagsManifest();
    if (!tagsManifest || !this.tagsManifestPath) {
      return;
    }

    const data = tagsManifest.items[tag] || {};
    data.revalidatedAt = Date.now();
    tagsManifest.items[tag] = data;

    try {
      await this.fs.mkdir(path.dirname(this.tagsManifestPath));
      await this.fs.writeFile(
        this.tagsManifestPath,
        JSON.stringify(tagsManifest || {}),
      );
    } catch (err) {
      console.warn("Failed to update tags manifest.", err);
    }
  }

  async get(key, { tags, softTags, kindHint } = {}) {
    let data = memoryCache?.get(key);
    // some code omitted for clarity

    return data ?? null;
  }

  async set(key, data, ctx) {
    memoryCache?.set(key, {
      value: data,
      lastModified: Date.now(),
    });
    // some code omitted for clarity
  }
  // more methods ...
}

module.exports = FileSystemCache;
