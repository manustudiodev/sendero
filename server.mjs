import { Hono } from "hono";
import { createApp } from "./server/app.mjs";

export default createApp({ app: new Hono() });
