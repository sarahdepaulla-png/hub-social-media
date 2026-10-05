/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */
  
  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  import type * as access from "../access.js";
import type * as auth from "../auth.js";
import type * as calendar from "../calendar.js";
import type * as captions from "../captions.js";
import type * as clients from "../clients.js";
import type * as comments from "../comments.js";
import type * as contents from "../contents.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as ideas from "../ideas.js";
import type * as imports from "../imports.js";
import type * as invites from "../invites.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_content from "../lib/content.js";
import type * as lib_log from "../lib/log.js";
import type * as lib_opportunities from "../lib/opportunities.js";
import type * as lib_preview from "../lib/preview.js";
import type * as media from "../media.js";
import type * as opportunities from "../opportunities.js";
import type * as otp from "../otp.js";
import type * as previews from "../previews.js";
import type * as seed from "../seed.js";
import type * as viewer from "../viewer.js";

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * ```js
   * const myFunctionReference = api.myModule.myFunction;
   * ```
   */
  declare const fullApi: ApiFromModules<{
    "access": typeof access,
"auth": typeof auth,
"calendar": typeof calendar,
"captions": typeof captions,
"clients": typeof clients,
"comments": typeof comments,
"contents": typeof contents,
"dashboard": typeof dashboard,
"http": typeof http,
"ideas": typeof ideas,
"imports": typeof imports,
"invites": typeof invites,
"lib/access": typeof lib_access,
"lib/content": typeof lib_content,
"lib/log": typeof lib_log,
"lib/opportunities": typeof lib_opportunities,
"lib/preview": typeof lib_preview,
"media": typeof media,
"opportunities": typeof opportunities,
"otp": typeof otp,
"previews": typeof previews,
"seed": typeof seed,
"viewer": typeof viewer,
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  