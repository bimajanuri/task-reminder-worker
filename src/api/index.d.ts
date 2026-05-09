type Bindings = {
    DB: D1Database;
    WAHA_URL: string;
    WAHA_API_KEY: string;
};
declare const _default: {
    fetch: (request: Request, Env?: {} | Bindings | undefined, executionCtx?: import("hono").ExecutionContext) => Response | Promise<Response>;
    scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map